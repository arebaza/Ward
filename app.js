"use strict";

/**
 * Park 5th Ward — Shared password pilot (GitHub Pages frontend + Cloudflare Worker backend).
 * NO PRIVATE RECORDS OR PASSWORDS belong in this public JS file or GitHub repository.
 * The backend validates the shared password and persists the latest directory and coordinates.
 */
const API_URL = String(window.PARK5_API_URL || "").replace(/\/$/, "");
let sessionToken = ""; // Memory only. New tab/reload requires password again.
async function apiRequest(path, method = "GET", body) {
  if (!/^https:\/\/[-a-zA-Z0-9.]+\.workers\.dev$/.test(API_URL)) {
    throw Error("Configure config.js with your Cloudflare Worker workers.dev URL before signing in.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API_URL + path, {
      method,
      mode: "cors",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(sessionToken ? { Authorization: "Bearer " + sessionToken } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path !== "/api/login") {
        sessionToken = "";
        $("loginScreen").classList.remove("hidden");
        $("dashboard").classList.add("hidden");
        $("loginError").textContent = "Session expired. Please enter the password again.";
      }
      throw Error(data.error || `Server error ${response.status}`);
    }
    return data;
  } catch (err) {
    if (err?.name === "AbortError") throw Error("Connection timed out. Check Cloudflare Worker settings.");
    throw err;
  } finally { clearTimeout(timer); }
}
const OREM_CENTER = [40.297, -111.694];

const DEMO_MEMBERS = [
  {name:"Rivera, Sofia",gender:"F",age:"",birth_date:"",address:"FICTIONAL HOME A, OREM UT",phone:"",email:"",demoCoords:[40.2974,-111.6950]},
  {name:"Rivera, Mateo",gender:"M",age:"",birth_date:"",address:"FICTIONAL HOME A, OREM UT",phone:"",email:"",demoCoords:[40.2974,-111.6950]},
  {name:"Rivera, Elena",gender:"F",age:"",birth_date:"",address:"FICTIONAL HOME A, OREM UT",phone:"",email:"",demoCoords:[40.2974,-111.6950]},
  {name:"Chen, Mei",gender:"F",age:"",birth_date:"",address:"FICTIONAL HOME B, OREM UT",phone:"",email:"",demoCoords:[40.2958,-111.6942]},
  {name:"Chen, Daniel",gender:"M",age:"",birth_date:"",address:"FICTIONAL HOME B, OREM UT",phone:"",email:"",demoCoords:[40.2958,-111.6942]},
  {name:"Patel, Asha",gender:"F",age:"",birth_date:"",address:"FICTIONAL HOME C, OREM UT",phone:"",email:"",demoCoords:[40.2979,-111.6919]},
  {name:"Patel, Neil",gender:"M",age:"",birth_date:"",address:"FICTIONAL HOME C, OREM UT",phone:"",email:"",demoCoords:[40.2979,-111.6919]},
  {name:"Morgan, Taylor",gender:"F",age:"",birth_date:"",address:"FICTIONAL HOME D, OREM UT",phone:"",email:"",demoCoords:[40.2954,-111.6965]},
  {name:"Morgan, Jordan",gender:"M",age:"",birth_date:"",address:"FICTIONAL HOME D, OREM UT",phone:"",email:"",demoCoords:[40.2954,-111.6965]}
];

const $ = id => document.getElementById(id);
const state = {
  demo:true, members:[], households:[], selectedId:null, map:null,
  markers:new Map(), markerLayer:null, coordinateRows:[],
  changedCoordinates:new Map(), markersReady:false
};

function text(value) { return String(value ?? "").trim(); }
function element(tag, cls, content) {
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(content !== undefined)item.textContent=String(content);
  return item;
}
function setStatus(message,kind="") {
  $("status").textContent=message;
  $("status").className="status"+(kind?" "+kind+"-text":"");
}
function validCoordinates(lat,lng) {
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
}
function capitalizeFirst(s){return s? s.charAt(0).toUpperCase()+s.slice(1):"";}

// Mirrors the Python prototype's address normalization for the supplied household CSV.
function normalizedAddress(raw) {
  let x=text(raw).replace(/[\r\n]/g," ").toUpperCase().replace(/\s+/g," ").trim();
  let city=/\bLOGANDALE\s+NV\b/.test(x)?"LOGANDALE NV":"OREM UT";
  x=x.replace(/\bOREM\s+UT\b.*$/g,"")
     .replace(/\bOREM\s+\d{5}\b.*$/g,"")
     .replace(/\bLOGANDALE\s+NV\b.*$/g,"")
     .replace(/\bUT\s+\d{5}(?:-\d{4})?\b/g,"");
  for(const [word,abbr] of [["WEST","W"],["SOUTH","S"],["EAST","E"],["NORTH","N"],["STREET","ST"],["AVENUE","AVE"]]) {
    x=x.replace(new RegExp("\\b"+word+"\\b","g"),abbr);
  }
  x=x.replace(/\b(APARTMENT|APT|UNIT)\s*#?\s*/g," UNIT ")
     .replace(/#\s*([A-Z]\s*-?\s*\d+)/g," UNIT $1")
     .replace(/\bC\s*-\s*(\d+)\b/g,"C$1")
     .replace(/\bS\s+ST\s+ST\b/g,"S STATE ST")
     .replace(/[^A-Z0-9\s#-]/g," ").replace(/\s+/g," ").trim();
  return x?`${x}, ${city}`:"UNKNOWN ADDRESS";
}
async function householdID(normalized) {
  if(!crypto?.subtle) return `ADDRESS:${normalized}`; // Fallback: match CSV by address.
  const bytes=new TextEncoder().encode(normalized);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");
  return "H-"+hash.slice(0,10).toUpperCase();
}
function familyLabel(members) {
  const familyNames=[...new Set(members.map(m=>text(m.name).split(",")[0].trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  if(!familyNames.length)return "Household";
  return familyNames.slice(0,3).join(" / ")+(familyNames.length>3?" + others":"");
}
async function groupMembers(members) {
  const group=new Map();
  for(const member of members) {
    const address=normalizedAddress(member.address);
    if(!group.has(address))group.set(address,[]);
    group.get(address).push(member);
  }
  const houses=[];
  for(const [address,people] of group) {
    const id=await householdID(address);
    people.sort((a,b)=>a.name.localeCompare(b.name));
    const demoCoords=state.demo&&people[0].demoCoords;
    houses.push({
      id,address,label:familyLabel(people),members:people,count:people.length,
      lat:demoCoords?demoCoords[0]:null,lng:demoCoords?demoCoords[1]:null,
      review_status:demoCoords?"Fictional point":"Pending"
    });
  }
  return houses.sort((a,b)=>a.label.localeCompare(b.label)||a.address.localeCompare(b.address));
}
function attachCoordinates() {
  const byID=new Map(),byAddress=new Map();
  for(const row of state.coordinateRows) {
    const lat=Number(row.latitude),lng=Number(row.longitude);
    if(!text(row.latitude)||!text(row.longitude)||!validCoordinates(lat,lng))continue;
    if(text(row.household_id))byID.set(text(row.household_id).toUpperCase(),row);
    if(text(row.address))byAddress.set(normalizedAddress(row.address),row);
  }
  for(const house of state.households) {
    const row=state.changedCoordinates.get(house.id)||byID.get(house.id)||byAddress.get(house.address);
    if(row){house.lat=Number(row.latitude);house.lng=Number(row.longitude);house.review_status=text(row.review_status)||"Verify point";}
  }
}
async function useMembers(members,{demo=false,info=""}={}) {
  if(!members.length)throw Error("No member rows found in the selected file.");
  state.demo=demo;
  state.members=members;
  state.selectedId=null;
  state.changedCoordinates.clear();
  if(demo)state.coordinateRows=[];
  state.households=await groupMembers(members);
  if(!demo)attachCoordinates();
  $("search").value="";
  $("mapFilter").value="all";
  $("placeOnMap").checked=false;
  $("sourceBadge").textContent=demo?"Demo families (local)":"Shared directory";
  $("sourceBadge").style.background=demo?"#e4f7ef":"#fff1d9";
  $("sourceBadge").style.color=demo?"#167c62":"#9b6219";
  updateDisplay();
  setStatus(info||(demo?"Fictional demonstration loaded. Four map locations are simulated, not real residences.":`Loaded ${members.length} shared member records from the protected database.`),"success");
}
function updateDisplay() {
  const mapped=state.households.filter(h=>validCoordinates(h.lat,h.lng)).length;
  $("memberCount").textContent=state.members.length.toLocaleString();
  $("houseCount").textContent=state.households.length.toLocaleString();
  $("mappedCount").textContent=mapped.toLocaleString();
  $("missingCount").textContent=(state.households.length-mapped).toLocaleString();
  drawList();drawMap();drawSelected();
}
function filteredHouseholds() {
  const term=text($("search").value).toLowerCase();
  const filter=$("mapFilter").value;
  return state.households.filter(h=>{
    const mapped=validCoordinates(h.lat,h.lng);
    if(filter==="mapped"&&!mapped||filter==="unmapped"&&mapped)return false;
    return !term||[h.label,h.address,...h.members.map(m=>m.name)].some(s=>s.toLowerCase().includes(term));
  });
}
function drawList() {
  const list=$("householdList");list.replaceChildren();
  const rows=filteredHouseholds();
  $("visibleCount").textContent=rows.length;
  if(!rows.length){list.append(element("p","empty-list","No matching households. Try another search or filter."));return;}
  for(const house of rows) {
    const mapped=validCoordinates(house.lat,house.lng);
    const button=element("button","household-card"+(house.id===state.selectedId?" active":""));
    button.type="button";
    button.setAttribute("aria-pressed",house.id===state.selectedId?"true":"false");
    const title=element("div","household-title");
    title.append(element("span","",house.label));
    const arrow=element("span","","›");arrow.setAttribute("aria-hidden","true");title.append(arrow);
    button.append(title,element("div","household-address",house.address));
    const foot=element("div","household-foot");
    foot.append(element("span","",`${house.count} ${house.count===1?"member":"members"}`),element("span","status-pill "+(mapped?"ok":"missing"),mapped?"Mapped":"Needs location"));
    button.append(foot);
    button.addEventListener("click",()=>selectHousehold(house.id,{zoom:true}));
    list.append(button);
  }
}
function drawMap() {
  if(!state.map||!state.markerLayer)return;
  state.markerLayer.clearLayers();state.markers.clear();
  const mapped=state.households.filter(h=>validCoordinates(h.lat,h.lng));
  for(const house of mapped){
    const selected=house.id===state.selectedId;
    const icon=L.divIcon({className:"",html:`<div class="home-pin${selected?" selected":""}">⌂</div>`,iconSize:[31,31],iconAnchor:[15,29]});
    const marker=L.marker([house.lat,house.lng],{icon,title:house.label,alt:`Map marker for ${house.label}`});
    marker.on("click",()=>selectHousehold(house.id,{zoom:false}));
    marker.addTo(state.markerLayer);
    state.markers.set(house.id,marker);
  }
  $("mapSubhead").textContent=`${mapped.length} household ${mapped.length===1?"marker":"markers"} · Click a home to view members`;
  if(!state.selectedId&&mapped.length){
    if(state.demo)state.map.fitBounds(L.latLngBounds(mapped.map(h=>[h.lat,h.lng])).pad(.34),{maxZoom:15});
  }
}
function selectHousehold(id,{zoom=false}={}) {
  if(!state.households.some(h=>h.id===id))return;
  state.selectedId=id;
  $("placeOnMap").checked=false;
  drawList();drawMap();drawSelected();
  const house=state.households.find(h=>h.id===id);
  if(zoom&&validCoordinates(house.lat,house.lng)&&state.map){
    state.map.flyTo([house.lat,house.lng],17,{duration:.7});
  }
}
function drawSelected() {
  const house=state.households.find(h=>h.id===state.selectedId);
  $("emptyDetail").classList.toggle("hidden",!!house);
  $("selectedDetail").classList.toggle("hidden",!house);
  if(!house)return;
  $("selectedLabel").textContent=house.label;
  $("selectedAddress").textContent=house.address;
  $("selectedCount").textContent=`${house.count} ${house.count===1?"person":"people"}`;
  const mapped=validCoordinates(house.lat,house.lng);
  $("coordState").textContent=mapped?(state.demo?"Simulated map point — example only":"Coordinates supplied — verify property"):"No coordinates — add a verified location";
  $("latitude").value=mapped?house.lat:"";
  $("longitude").value=mapped?house.lng:"";
  const isDemo=state.demo;
  const destination=isDemo?null:house.address;
  $("directions").href=destination?"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(destination):"#";
  $("directions").setAttribute("aria-disabled",isDemo?"true":"false");
  $("directions").classList.toggle("disabled",isDemo);
  if(isDemo){$("directions").title="Directions are disabled for fictional addresses.";$("directions").removeAttribute("target");}
  else{$("directions").title="Open Google Maps directions in a new tab";$("directions").target="_blank";}
  const list=$("memberList");list.replaceChildren();
  for(const member of house.members){
    const row=element("div","member-row");
    const initials=member.name.split(/[\s,]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
    row.append(element("div","avatar",initials));
    const info=element("div","member-info");info.append(element("div","member-name",member.name));
    const meta=element("div","member-meta");
    for(const item of [member.gender,member.age!==""&&member.age!=null?`Age ${member.age}`:"",member.birth_date?`Birthday ${member.birth_date}`:""]){
      if(item)meta.append(element("span","",item));
    }
    if(meta.childNodes.length)info.append(meta);
    const contacts=element("div","member-contacts");
    if(member.phone){const a=element("a","",member.phone);a.href="tel:"+member.phone.replace(/[^0-9+]/g,"");contacts.append(a);}
    if(member.email){const a=element("a","",member.email);a.href="mailto:"+encodeURIComponent(member.email);contacts.append(a);}
    if(contacts.childNodes.length)info.append(contacts);
    row.append(info);list.append(row);
  }
}
function initMap(){
  if(typeof L==="undefined"){
    $("mapUnavailable").classList.remove("hidden");
    $("mapUnavailable").textContent="Leaflet library unavailable. Check Internet access. Household search and directions will still work.";
    return;
  }
  state.map=L.map("map",{zoomControl:true}).setView(OREM_CENTER,14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom:19
  }).addTo(state.map);
  state.markerLayer=L.layerGroup().addTo(state.map);
  state.map.on("click",async e=>{
    if(!$("placeOnMap").checked||!state.selectedId)return;
    $("placeOnMap").checked=false;
    try {
      await saveLocation(e.latlng.lat,e.latlng.lng,"Placed by map click — verify");
      setStatus("Location saved to shared database. Other users will see it when they refresh.","success");
    } catch(error) { setStatus("Location NOT saved: " + error.message,"error"); }
  });
  state.map.whenReady(()=>setTimeout(()=>state.map.invalidateSize(),100));
}
async function saveLocation(lat,lng,reviewStatus="Manual — verify"){
  const house=state.households.find(h=>h.id===state.selectedId);
  if(!house)throw Error("Select a household before entering coordinates.");
  if(state.demo)throw Error("Switch to a shared directory before saving real locations.");
  if(!validCoordinates(lat,lng))throw Error("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
  // Save remotely FIRST. If it fails, local UI must not claim that it was saved.
  await apiRequest("/api/coordinates", "PUT", {coordinates:[{
    address_key:house.address,latitude:lat,longitude:lng,review_status:reviewStatus
  }]});
  house.lat=lat;house.lng=lng;house.review_status=reviewStatus;
  const row={household_id:house.id,address:house.address,latitude:lat,longitude:lng,review_status:reviewStatus};
  state.changedCoordinates.set(house.id,row);
  state.coordinateRows=state.coordinateRows.filter(r=>normalizedAddress(r.address)!==house.address);
  state.coordinateRows.push(row);
  updateDisplay();
  if(state.map)state.map.flyTo([lat,lng],17,{duration:.65});
}
function parseCSV(csv) {
  const result=[];let current=[],value="",quoted=false;
  const src=csv.replace(/^\uFEFF/,"");
  for(let i=0;i<src.length;i++){
    const c=src[i];
    if(c==='"'){
      if(quoted&&src[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
    }else if(c===","&&!quoted){current.push(value);value="";}
    else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&src[i+1]==="\n")i++;
      current.push(value);if(current.some(s=>s.trim()))result.push(current);
      current=[];value="";
    }else value+=c;
  }
  if(quoted)throw Error("CSV has an unmatched quotation mark.");
  current.push(value);if(current.some(s=>s.trim()))result.push(current);
  return result;
}
function rowsToObjects(rows){
  if(!rows.length)return [];
  const header=rows[0].map(s=>text(s).toLowerCase().replace(/[\s-]+/g,"_"));
  return rows.slice(1).map(row=>Object.fromEntries(header.map((key,i)=>[key,text(row[i])])));
}
function pick(obj,aliases){
  for(const alias of aliases){const key=alias.toLowerCase().replace(/[\s-]+/g,"_");if(text(obj[key]))return text(obj[key]);}
  return "";
}
function memberRecords(rows){
  const headerIndex=rows.findIndex(row=>{
    const names=row.map(c=>text(c).toLowerCase());
    return names.includes("name")&&names.includes("address");
  });
  if(headerIndex<0)throw Error('Expected a header row containing "Name" and "Address". Select the workbook with a Members sheet.');
  const keys=rows[headerIndex].map(v=>text(v).toLowerCase().replace(/[\s-]+/g,"_"));
  return rows.slice(headerIndex+1).map(row=>Object.fromEntries(keys.map((key,i)=>[key,text(row[i])]))).map(row=>({
    name:pick(row,["name","member_name"]),
    address:pick(row,["address","home_address"]),
    gender:pick(row,["gender","sex"]),
    age:pick(row,["age"]),
    birth_date:pick(row,["birth_date","birthday","birthdate"]),
    phone:pick(row,["phone_number","phone","telephone"]),
    email:pick(row,["email","email_address"])
  })).filter(m=>m.name&&m.address);
}
async function extractRows(file,preferredSheet){
  if(file.size>15*1024*1024)throw Error("Please select a file smaller than 15 MB.");
  if(file.name.toLowerCase().endsWith(".csv"))return parseCSV(await file.text());
  if(!file.name.toLowerCase().match(/\.(xlsx|xls)$/))throw Error("Supported file types: .xlsx, .xls, .csv");
  if(typeof XLSX==="undefined")throw Error("Excel import library failed to load. Verify that your browser has Internet access.");
  const buffer=await file.arrayBuffer();
  const workbook=XLSX.read(buffer,{type:"array",cellDates:false});
  const name=workbook.SheetNames.find(n=>n.toLowerCase()===preferredSheet.toLowerCase())||workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:"",raw:false,blankrows:false});
}
async function loadMemberFile(file){
  try{
    setStatus("Reading your local file…");
    const rows=await extractRows(file,"Members");
    const people=memberRecords(rows);
    if(!people.length)throw Error("No members found. Ensure Name and Address columns are populated.");
    setStatus(`Uploading ${people.length} records to shared database…`);
    const saved=await apiRequest("/api/directory","PUT",{members:people,filename:file.name});
    await refreshShared();
    setStatus(`Saved ${saved.count} members from ${saved.filename} to the shared database. The newest Excel replaces the previous member list; saved coordinates remain.`,"success");
  }catch(err){setStatus(err.message||"Unable to read spreadsheet.","error");}
}
async function loadCoordsFile(file){
  try{
    const rows=await extractRows(file,"Coordinates");
    const coords=rowsToObjects(rows);
    if(!coords.length||!("latitude" in coords[0])||!("longitude" in coords[0])||!("household_id" in coords[0]||"address" in coords[0])){
      throw Error("Coordinates file needs household_id or address, latitude, longitude columns.");
    }
    if(state.demo)throw Error("Load the shared member directory first, then import coordinates.");
    state.coordinateRows=coords;
    attachCoordinates();updateDisplay();
    const mapped=state.households.filter(h=>validCoordinates(h.lat,h.lng));
    if(!mapped.length){setStatus("Coordinates file contained no valid matching locations. No changes were saved.","error");return;}
    // Save only verified/matched locations. Existing locations remain if not in this CSV.
    const result=await apiRequest("/api/coordinates","PUT",{coordinates:mapped.map(h=>({
      address_key:h.address, latitude:h.lat, longitude:h.lng, review_status:h.review_status||"CSV import — verify"
    }))});
    await refreshShared();
    setStatus(`${result.count} mapped households saved to the shared database. Users see them after refresh.`,"success");
  }catch(err){setStatus(err.message||"Unable to read coordinates.","error");}
}
function csvEscape(value){const str=text(value);return /[",\n\r]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;}
function downloadCoordinates(){
  const header=["household_id","address","latitude","longitude","review_status"];
  const rows=[header.join(",")];
  for(const h of [...state.households].sort((a,b)=>a.address.localeCompare(b.address))){
    rows.push([h.id,h.address,validCoordinates(h.lat,h.lng)?h.lat:"",validCoordinates(h.lat,h.lng)?h.lng:"",h.review_status||"Pending"].map(csvEscape).join(","));
  }
  const blob=new Blob(["\uFEFF"+rows.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=state.demo?"DEMO_household_coordinates.csv":"Park5_Household_Map_Coordinates_updated.csv";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setStatus("Backup CSV downloaded. Coordinates are also saved to the shared database after each successful change.","success");
}
function focusSelected(){
  const h=state.households.find(x=>x.id===state.selectedId);
  if(!h)return;
  if(validCoordinates(h.lat,h.lng)&&state.map){state.map.flyTo([h.lat,h.lng],17,{duration:.65});return;}
  if(state.demo){setStatus("This simulated home has no coordinates. Select another home or place a map point.");return;}
  window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(h.address),"_blank","noopener,noreferrer");
  setStatus("Opened an address search in Google Maps. Verify it is the correct household before saving coordinates.");
}
function updatedLabel(snapshot){
  const name=text(snapshot.filename);
  if(!name)return "Shared database: no Excel uploaded yet";
  return `Latest shared Excel: ${name} · saved ${snapshot.updated_at || "recently"} UTC`;
}
async function refreshShared(){
  const snapshot=await apiRequest("/api/state");
  state.coordinateRows=(snapshot.coordinates||[]).map(c=>({
    address:c.address_key,latitude:c.latitude,longitude:c.longitude,
    review_status:c.review_status
  }));
  $("syncDetails").textContent=updatedLabel(snapshot);
  if(Array.isArray(snapshot.members)&&snapshot.members.length){
    await useMembers(snapshot.members,{demo:false,info:`Shared directory loaded: ${snapshot.members.length} members. ${updatedLabel(snapshot)}`});
  }else{
    await useMembers(DEMO_MEMBERS,{demo:true,info:"No shared Excel saved yet. Showing fictional examples. Use Load Excel to publish the first shared directory."});
    // Keep coordinates from shared server for first real Excel import.
    state.coordinateRows=(snapshot.coordinates||[]).map(c=>({address:c.address_key,latitude:c.latitude,longitude:c.longitude,review_status:c.review_status}));
  }
}
function boot(){
  $("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();
    $("loginError").textContent="Checking password…";
    try {
      const result=await apiRequest("/api/login","POST",{password:$("passcode").value});
      sessionToken=result.token;
      $("passcode").value="";
      $("loginError").textContent="";
      $("loginScreen").classList.add("hidden");
      $("dashboard").classList.remove("hidden");
      if(!state.map)initMap();
      await refreshShared();
      setTimeout(()=>state.map?.invalidateSize(),250);
    } catch(error){ $("loginError").textContent=error.message||"Unable to sign in."; }
  });
  $("search").addEventListener("input",drawList);
  $("mapFilter").addEventListener("change",drawList);
  $("clearSelection").addEventListener("click",()=>{state.selectedId=null;$("placeOnMap").checked=false;updateDisplay();});
  $("resetDemo").addEventListener("click",()=>{useMembers(DEMO_MEMBERS,{demo:true});$("memberFile").value="";$("coordsFile").value="";setStatus("Fictional example shown locally. Shared database is unchanged. Click Refresh shared data to return.","success");});
  $("refreshShared").addEventListener("click",async()=>{
    try {setStatus("Refreshing shared directory…");await refreshShared();}
    catch(error){setStatus("Refresh failed: "+error.message,"error");}
  });
  $("memberFile").addEventListener("change",async e=>{if(e.target.files[0])await loadMemberFile(e.target.files[0]);e.target.value="";});
  $("coordsFile").addEventListener("change",async e=>{if(e.target.files[0])await loadCoordsFile(e.target.files[0]);e.target.value="";});
  $("downloadCoords").addEventListener("click",downloadCoordinates);
  $("focusHome").addEventListener("click",focusSelected);
  $("directions").addEventListener("click",e=>{if(state.demo)e.preventDefault();});
  $("coordinateForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const rawLat=text($("latitude").value),rawLng=text($("longitude").value);
      if(!rawLat||!rawLng)throw Error("Enter both latitude and longitude.");
      setStatus("Saving coordinates to shared database…");
      await saveLocation(Number(rawLat),Number(rawLng));
      setStatus("Coordinates saved to shared database. Other users will see them on refresh.","success");
    }catch(error){setStatus("Not saved: "+error.message,"error");}
  });
}
boot();
