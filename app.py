"""Park 5th Ward — household locator demo/private pilot.
DO NOT expose real member information as a public directory.
"""
from __future__ import annotations

import html
import io
import hmac
from pathlib import Path
from urllib.parse import quote_plus
import streamlit as st
import folium
from folium.plugins import MarkerCluster
from streamlit_folium import st_folium
from directory import read_members, make_households, parse_coords, coords_csv

st.set_page_config(page_title='Household Locator | Private Pilot',page_icon='🗺️',layout='wide')
st.title('🗺️ Park 5th Ward — Household Locator')
st.caption('Map ↔ household directory  •  Private missionary coordination pilot')


def secrets_dict():
    try: return st.secrets.to_dict()
    except (FileNotFoundError, AttributeError): return {}


def access_mode():
    """Require configured identity/access to open real records; public visitors see fake demo only."""
    sec=secrets_dict()
    if 'auth' in sec:
        if not st.user.is_logged_in:
            st.info('Sign in with an authorized account to open member information.')
            if st.button('Sign in'): st.login()
            st.stop()
        user_email=str(st.user.get('email','')).lower()
        allowed=[s.strip().lower() for s in sec.get('allowed_emails',[])]
        if not allowed or user_email not in allowed:
            st.error('Account not on approved viewer list. Access denied.')
            if st.button('Sign out'): st.logout()
            st.stop()
        with st.sidebar:
            st.success(f'Signed in: {user_email}')
            if st.button('Sign out'): st.logout()
        return 'oidc'
    password=sec.get('PILOT_PASSWORD','')
    if password:
        if not st.session_state.get('authenticated'):
            with st.form('pilot_password'):
                pwd=st.text_input('Pilot access password',type='password')
                submitted=st.form_submit_button('Open private pilot')
            if submitted and hmac.compare_digest(pwd,str(password)):
                st.session_state.authenticated=True
                st.rerun()
            elif submitted:
                st.error('Incorrect password.')
            st.stop()
        st.sidebar.warning('Password-gated PILOT ONLY; production should use organization-approved SSO.')
        if st.sidebar.button('Lock session'):
            st.session_state.authenticated=False
            st.rerun()
        return 'pilot'
    st.info('**Safe demonstration mode:** The app contains fictional people and approximate example pins. Configure approved authentication to load real member records.')
    return 'demo'


mode=access_mode()

DEMO_MEMBERS=[
    {'name':'Sample, Ana','gender':'F','age':None,'birth_date':'5 Mar','address':'Example Home A, Orem UT','phone':'(555) 010-1001','email':'ana@example.invalid','pdf_page':''},
    {'name':'Sample, Luis','gender':'M','age':None,'birth_date':'14 Oct','address':'Example Home A, Orem UT','phone':'','email':'','pdf_page':''},
    {'name':'Example, Mia','gender':'F','age':None,'birth_date':'12 Jun','address':'Example Home B, Orem UT','phone':'','email':'','pdf_page':''},
    {'name':'Example, Joel','gender':'M','age':None,'birth_date':'16 May','address':'Example Home B, Orem UT','phone':'','email':'','pdf_page':''},
    {'name':'Fiction, Oliver','gender':'M','age':None,'birth_date':'3 Feb','address':'Example Home C, Orem UT','phone':'','email':'','pdf_page':''},
    {'name':'Fiction, Emma','gender':'F','age':None,'birth_date':'2 Jan','address':'Example Home C, Orem UT','phone':'','email':'','pdf_page':''},
    {'name':'Demo, Alma','gender':'F','age':None,'birth_date':'13 Sep','address':'Example Home D, Orem UT','phone':'','email':'','pdf_page':''},
]

# Approved private hosting may mount files outside the code repository.
# All such files must be protected at the infrastructure level with role checks.
sec=secrets_dict()
with st.sidebar:
    st.header('Data source')
    if mode=='demo':
        st.caption('Demo (fictional people, deliberately approximate pin locations).')
        member_bytes=None
        coord_bytes=None
    else:
        hosted_members=None
        hosted_coords=None
        member_path=sec.get('DATA_XLSX_PATH')
        coords_path=sec.get('COORDINATES_CSV_PATH')
        if member_path:
            path=Path(member_path)
            if path.is_file():
                hosted_members=path.read_bytes()
                st.success('Authorized shared directory is available.')
            else:
                st.error('Configured server-side directory file was not found.')
        if coords_path and Path(coords_path).is_file():
            hosted_coords=Path(coords_path).read_bytes()
        member_upload=st.file_uploader('1 · Load / override member workbook',type=['xlsx'],key='member_file',help='Read only in the current session; the app does not save uploads.')
        coord_upload=st.file_uploader('2 · Load / override coordinates .csv',type=['csv'],key='coord_file',help='Coordinate locations should be reviewed before use.')
        member_bytes=member_upload.getvalue() if member_upload else hosted_members
        coord_bytes=coord_upload.getvalue() if coord_upload else hosted_coords
    st.markdown('---')
    st.caption('For Church use only · Permission required · No public member directory')

if mode=='demo':
    members=DEMO_MEMBERS
else:
    if not member_bytes:
        st.info('Upload your member Excel file in the sidebar to build searchable households.')
        st.stop()
    try: members=read_members(member_bytes)
    except Exception as exc:
        st.error(f'Could not read workbook: {exc}')
        st.stop()

houses=make_households(members)
coords={}
if mode=='demo':
    # Approximate illustrative points — NOT address geocoding and NOT real residences.
    sample_locs=[(40.2913,-111.6903),(40.2964,-111.6973),(40.2893,-111.7004),(40.2972,-111.6881)]
    coords={h['id']:sample_locs[i] for i,h in enumerate(houses[:len(sample_locs)])}
elif coord_bytes:
    try: coords=parse_coords(coord_bytes)
    except Exception as exc: st.warning(f'Coordinates could not be loaded: {exc}')
for h in houses:
    if h['id'] in coords:
        h['latitude'],h['longitude']=coords[h['id']]

with st.sidebar:
    st.header('Map setup')
    st.download_button('⬇️ Download household coordinates template',
                       data=coords_csv(houses),file_name='household_coordinates.csv',mime='text/csv',
                       help='Open in Excel, enter the verified latitude/longitude, save again as CSV UTF-8.')
    st.caption(f'{len(members)} members • {len(houses)} addresses • {sum(h["latitude"] is not None for h in houses)} mapped')
    if mode!='demo' and not coord_bytes:
        st.caption('No pins until coordinates are provided. This prevents unapproved third-party geocoding.')

c1,c2,c3=st.columns(3)
c1.metric('Members',len(members))
c2.metric('Household addresses',len(houses))
c3.metric('Mapped homes',sum(h['latitude'] is not None for h in houses))

query=st.text_input('🔎 Search member, family name, or street',placeholder='Type a last name, first name, street, apartment unit…')
only_mapped=st.checkbox('Only show homes with a verified map location',value=False)
q=query.casefold().strip()
shown=[h for h in houses if (not only_mapped or h['latitude'] is not None) and
       (not q or q in h['address'].casefold() or q in h['label'].casefold() or
        any(q in p['name'].casefold() for p in h['members']))]
if not shown:
    st.warning('No homes matched. Try clearing your search or the mapped-only filter.')
    st.stop()
by_id={h['id']:h for h in shown}
ids=list(by_id)
selected_id=st.session_state.get('selected_id')
if selected_id not in by_id: selected_id=ids[0]
choice=st.selectbox('Select a home or family', ids,
    index=ids.index(selected_id),
    format_func=lambda hid:f'{by_id[hid]["label"]}  —  {by_id[hid]["address"]}  ({by_id[hid]["count"]})',
    key='picker_'+selected_id)
if choice!=selected_id:
    st.session_state['selected_id']=choice
    st.rerun()
selected=by_id[choice]

map_col,detail_col=st.columns([1.6,1.0],gap='large')
with map_col:
    st.subheader('Interactive ward map')
    locs=[h for h in shown if h['latitude'] is not None]
    center=[selected['latitude'],selected['longitude']] if selected['latitude'] is not None else [40.2969,-111.6946]
    m=folium.Map(location=center, zoom_start=15 if selected['latitude'] is not None else 13,
                 tiles='OpenStreetMap',control_scale=True)
    cluster=MarkerCluster(name='Homes').add_to(m)
    for h in locs:
        name=html.escape(h['label'])
        address=html.escape(h['address'])
        tooltip=h['id']+' | '+h['label']
        folium.Marker(
            location=[h['latitude'],h['longitude']],
            tooltip=tooltip,
            popup=folium.Popup(f'<strong>{name}</strong><br>{address}<br>{h["count"]} people<br>Click pin to show household details.',max_width=300),
            icon=folium.Icon(color='green' if h['id']==choice else 'blue',icon='home',prefix='fa'),
        ).add_to(cluster)
    if selected['latitude'] is not None:
        folium.CircleMarker([selected['latitude'],selected['longitude']],radius=16,
                            color='#CC7A00',fill=False,weight=4,tooltip='Selected home').add_to(m)
    map_data=st_folium(m,height=510,use_container_width=True,returned_objects=['last_object_clicked_tooltip'],key='ward_map')
    clicked=map_data.get('last_object_clicked_tooltip') if map_data else None
    clicked_id=clicked.split(' | ',1)[0] if isinstance(clicked,str) else None
    if clicked_id and clicked_id in by_id and clicked_id!=choice:
        st.session_state['selected_id']=clicked_id
        st.rerun()
    if not locs:
        st.warning('Map pins require verified latitude and longitude. Download and fill the coordinates template, then upload the CSV.')
    if mode=='demo':
        st.caption('🧪 Demo pins are illustrative only; they do not represent actual homes.')
    else:
        st.caption('Map tiles load from a third-party provider. Do not use outside approved Church data-handling policies.')

with detail_col:
    st.subheader('Selected household')
    st.markdown(f'**{selected["label"]}**')
    st.write(selected['address'])
    st.caption(f'{selected["count"]} member records at this address. This is address grouping, not verified family relationships.')
    if selected['review_needed']:
        st.info('Different surnames share this address. Verify household/family relationships before assigning visits.')
    if mode!='demo':
        dirs='https://www.google.com/maps/dir/?api=1&destination='+quote_plus(selected['address'])
        st.link_button('↗ Directions in Google Maps',dirs,use_container_width=True)
    else:
        st.caption('Directions are disabled for fictional demo homes.')
    if selected['latitude'] is None:
        st.warning('This household has no verified map pin yet.')
    st.markdown('#### People at this address')
    for person in selected['members']:
        with st.expander(person['name'],expanded=selected['count']<4):
            st.write('**Gender:**',person['gender'] or '—')
            st.write('**Age:**',person['age'] if person['age'] is not None else '—')
            st.write('**Birth date:**',person['birth_date'] or '—')
            st.write('**Phone:**',person['phone'] or '—')
            st.write('**Email:**',person['email'] or '—')
            if person['pdf_page']: st.caption(f'Original directory page: {person["pdf_page"]}')

st.divider()
st.caption('This is a prototype, not an approved public distribution system. Use organization-approved SSO, storage, roles, audit logs and retention before broader rollout. Never post raw member files in a public GitHub repository.')
