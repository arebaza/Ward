"""XLSX member reader (stdlib) and household grouping.

The app doesn't need pandas/openpyxl. Only the Members sheet is read.
Coordinates are never inferred from someone's street address.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import PurePosixPath
from zipfile import ZipFile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'p': 'http://schemas.openxmlformats.org/package/2006/relationships'}


def _parse_xlsx_sheet(data: bytes, sheet_name='Members') -> list[dict]:
    with ZipFile(io.BytesIO(data)) as z:
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings=[''.join(node.text or '' for node in si.findall('.//s:t', NS))
                     for si in root.findall('s:si', NS)]
        root=ET.fromstring(z.read('xl/workbook.xml'))
        sh=next((s for s in root.findall('.//s:sheet', NS) if s.attrib.get('name') == sheet_name), None)
        if sh is None:
            raise ValueError(f'Could not find sheet {sheet_name!r}. The workbook must contain a Members sheet.')
        rel_id=sh.attrib.get('{'+NS['r']+'}id')
        relroot=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target=next((r.attrib['Target'] for r in relroot.findall('p:Relationship', NS)
                     if r.attrib['Id']==rel_id), None)
        if not target:
            raise ValueError('Members sheet relationship not found.')
        if target.startswith('/'): file=target.lstrip('/')
        else: file='xl/'+target.lstrip('./')
        file=str(PurePosixPath(file))
        if file not in z.namelist():
            file='xl/worksheets/'+PurePosixPath(target).name
        sheet_root=ET.fromstring(z.read(file))
        result=[]
        for row in sheet_root.findall('.//s:sheetData/s:row', NS):
            cells={}
            for c in row.findall('s:c', NS):
                col=re.match(r'([A-Z]+)', c.attrib.get('r',''))
                if not col: continue
                value_node=c.find('s:v',NS)
                value=value_node.text if value_node is not None else None
                if c.attrib.get('t')=='inlineStr':
                    inline=c.find('s:is',NS)
                    value=''.join(n.text or '' for n in inline.findall('.//s:t', NS)) if inline is not None else None
                elif c.attrib.get('t')=='s' and value is not None:
                    value=strings[int(value)]
                elif c.attrib.get('t')=='b' and value is not None:
                    value=(value=='1')
                cells[col.group(1)]=value
            result.append(cells)
        return result


def read_members(data: bytes) -> list[dict]:
    rows=_parse_xlsx_sheet(data)
    header=next((idx for idx,row in enumerate(rows) if str(row.get('B','')).strip()=='Name'
                 and str(row.get('F','')).strip()=='Address'), None)
    if header is None:
        raise ValueError('Members sheet does not have expected Name and Address columns (row 3).')
    records=[]
    for row in rows[header+1:]:
        name=str(row.get('B') or '').strip()
        if not name: continue
        age=row.get('D')
        try: age=int(float(age)) if age not in ('',None) else None
        except (ValueError,TypeError): age=None
        def clean(cell):
            val=row.get(cell)
            # Some exported spreadsheets use numeric placeholder for truly blank values.
            return '' if val is None or str(val).strip() in ('', '1315') else str(val).strip()
        records.append({'name': name, 'gender':clean('C'), 'age':age,
                        'birth_date':clean('E'), 'address':clean('F'),
                        'phone':clean('G'), 'email':clean('H'),
                        'pdf_page':clean('I')})
    if not records:
        raise ValueError('No member records found.')
    return records


def normalized_address(raw: str) -> str:
    x=str(raw or '').replace('\r',' ').replace('\n',' ').upper()
    x=re.sub(r'\s+',' ',x).strip()
    city='OREM UT'
    if re.search(r'\bLOGANDALE\s+NV\b',x): city='LOGANDALE NV'
    # ZIP suffixes and city fragments don't define separate households.
    x=re.sub(r'\bOREM\s+UT\b.*$','',x)
    x=re.sub(r'\bOREM\s+\d{5}\b.*$','',x)
    x=re.sub(r'\bLOGANDALE\s+NV\b.*$','',x)
    x=re.sub(r'\bUT\s+\d{5}(?:-\d{4})?\b','',x)
    for phrase,abbr in [('WEST','W'),('SOUTH','S'),('EAST','E'),('NORTH','N'),
                         ('STREET','ST'),('AVENUE','AVE')]:
        x=re.sub(r'\b'+phrase+r'\b',abbr,x)
    x=re.sub(r'\b(APARTMENT|APT|UNIT)\s*#?\s*',' UNIT ',x)
    x=re.sub(r'#\s*([A-Z]\s*-?\s*\d+)',' UNIT \\1',x)
    x=re.sub(r'\bC\s*-\s*(\d+)\b',r'C\1',x)
    # One inconsistent source spelling: 360 S St Street = 360 S State Street.
    x=re.sub(r'\bS\s+ST\s+ST\b','S STATE ST',x)
    x=re.sub(r'[^A-Z0-9\s#-]',' ',x)
    x=re.sub(r'\s+',' ',x).strip()
    return f'{x}, {city}' if x else 'UNKNOWN ADDRESS'


def make_households(members: list[dict]) -> list[dict]:
    groups=defaultdict(list)
    for member in members:
        groups[normalized_address(member['address'])].append(member)
    households=[]
    for address, persons in groups.items():
        hid='H-'+hashlib.sha256(address.encode('utf-8')).hexdigest()[:10].upper()
        surnames=sorted({p['name'].split(',')[0].strip() for p in persons if ',' in p['name']})
        label=' / '.join(surnames[:3]) + (' + others' if len(surnames)>3 else '')
        households.append({'id':hid,'address':address,'label':label or 'Household',
                           'members':sorted(persons,key=lambda p:p['name'].casefold()),
                           'count':len(persons),'latitude':None,'longitude':None,
                           'review_needed': len(surnames)>1})
    return sorted(households,key=lambda h:(h['label'].casefold(),h['address'].casefold()))


def parse_coords(data:bytes, name='coordinates.csv') -> dict[str,tuple[float,float]]:
    if not name.lower().endswith('.csv'):
        raise ValueError('Upload a CSV. You can export the coordinates template from Excel as CSV UTF-8.')
    text=data.decode('utf-8-sig')
    reader=csv.DictReader(io.StringIO(text))
    fieldmap={name.strip().lower().replace(' ','_'):name for name in (reader.fieldnames or [])}
    if not {'household_id','latitude','longitude'}.issubset(fieldmap):
        raise ValueError('CSV needs household_id,latitude,longitude column headings.')
    coordinates={}
    for row in reader:
        hid=(row.get(fieldmap['household_id']) or '').strip()
        rawlat=(row.get(fieldmap['latitude']) or '').strip()
        rawlon=(row.get(fieldmap['longitude']) or '').strip()
        if not hid or not rawlat or not rawlon: continue
        try: lat=float(rawlat);lon=float(rawlon)
        except ValueError: continue
        if -90<=lat<=90 and -180<=lon<=180:
            coordinates[hid]=(lat,lon)
    return coordinates


def coords_csv(households:list[dict])->bytes:
    out=io.StringIO()
    writer=csv.writer(out,lineterminator='\n')
    writer.writerow(['household_id','address','latitude','longitude','review_status'])
    for h in sorted(households,key=lambda h:h['address']):
        writer.writerow([h['id'],h['address'],'','','Needs review' if h['review_needed'] else 'Pending'])
    return ('\ufeff'+out.getvalue()).encode('utf-8')
