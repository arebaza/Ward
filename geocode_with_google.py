"""OPTIONAL command-line batch helper.
Sends household ADDRESSES (not member names) to Google Geocoding API.
Only run after you have permission to disclose addresses to that service.
Requires GOOGLE_MAPS_API_KEY environment variable, Google Maps billing and consent flag.
"""
import argparse
import csv
import json
import os
import time
from urllib.parse import urlencode
from urllib.request import urlopen


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--input',default='household_coordinates.csv')
    p.add_argument('--output',default='household_coordinates_geocoded.csv')
    p.add_argument('--confirm-third-party',action='store_true',help='I am authorized to send address strings to Google.')
    p.add_argument('--max',type=int,default=200,help='Maximum new addresses to geocode')
    args=p.parse_args()
    key=os.environ.get('GOOGLE_MAPS_API_KEY')
    if not args.confirm_third_party or not key:
        p.error('Requires --confirm-third-party and GOOGLE_MAPS_API_KEY. Do not send addresses without authorization.')
    with open(args.input,encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f)
        rows=list(reader)
        fields=reader.fieldnames
    if not fields or not {'household_id','address','latitude','longitude'}.issubset(fields):
        p.error('CSV must have household_id,address,latitude,longitude.')
    count=0
    for r in rows:
        if r['latitude'].strip() and r['longitude'].strip(): continue
        if count>=args.max: break
        query=urlencode({'address':r['address'],'key':key})
        url='https://maps.googleapis.com/maps/api/geocode/json?'+query
        try:
            with urlopen(url,timeout=15) as response:
                data=json.load(response)
            if data.get('status')=='OK' and data.get('results'):
                geo=data['results'][0]['geometry']['location']
                r['latitude']=str(geo['lat'])
                r['longitude']=str(geo['lng'])
                r['review_status']='Needs verification'  # Geocode coordinates can be inaccurate.
                count+=1
                print('Matched',r['household_id'])
            else: print('Not matched:',r['household_id'],data.get('status'))
        except Exception as ex: print('Lookup error:',r['household_id'],ex)
        time.sleep(0.15)
    with open(args.output,'w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields)
        w.writeheader();w.writerows(rows)
    print('New geocoded homes:',count,'Output:',args.output)
    print('Check every coordinate before using in the private app.')

if __name__=='__main__':main()
