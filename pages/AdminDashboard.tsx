import React,{useState,useEffect} from"react";
import{api}from"../services/mockApi.ts";
import{Complaint,ComplaintStatus,Severity,AdminStats}from"../types";
import{Card,Button,StatusBadge}from"../components/UI.tsx";
import{MapContainer,TileLayer,CircleMarker,useMap}from"react-leaflet";
import{List,XCircle,Clock,BarChart3,AlertCircle,CheckCircle2,HardHat,RefreshCw,Calendar,Siren,Trash2,FileCheck,History,Download,Lock,Database}from"lucide-react";
import{COLORS}from"../constants";

const getMarkerColor=(s:number)=>s>=7.5?COLORS.alert:s>=3.5?COLORS.warning:COLORS.secondary;
const MapRefresher=({timestamp}:{timestamp:number})=>{const m=useMap();useEffect(()=>m.invalidateSize(),[timestamp,m]);return null};

const RealMap=({complaints,onSelect,selectedId,refreshTrigger}:{complaints:Complaint[],onSelect:(c:Complaint)=>void,selectedId?:string,refreshTrigger:number})=>(
<div className="w-full h-[500px] md:h-[600px] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border shadow-inner">
<MapContainer center={[17.385,78.4867]} zoom={11} scrollWheelZoom style={{height:"100%",width:"100%"}}>
<MapRefresher timestamp={refreshTrigger}/>
<TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
{complaints.map(c=><CircleMarker key={c.id} center={[c.latitude,c.longitude]} pathOptions={{color:selectedId===c.id?"#000":"#fff",fillColor:getMarkerColor(c.severityScore),fillOpacity:.85,weight:selectedId===c.id?3:1}} radius={selectedId===c.id?12:8} eventHandlers={{click:()=>onSelect(c)}} />)}
</MapContainer></div>
);

const StatCard=({title,value,subtext,icon:Icon,colorClass,bgClass}:any)=>(
<Card className="p-5 flex justify-between border-l-4" style={{borderLeftColor:colorClass}}>
<div><p className="text-xs text-gray-500 uppercase">{title}</p><h3 className="text-2xl font-bold">{value}</h3><p className="text-xs text-gray-400">{subtext}</p></div>
<div className={`p-3 rounded-lg ${bgClass}`}><Icon size={24} style={{color:colorClass}}/></div>
</Card>
);

export const AdminAudit=()=>{const[stats,setStats]=useState<AdminStats|null>(null);
useEffect(()=>{api.getAdminStats().then(setStats)},[]);
return(<div className="p-6 space-y-6 max-w-5xl mx-auto">
<h1 className="text-2xl font-bold">Activity Audit</h1>
<div className="grid md:grid-cols-2 gap-4">
<Card className="p-6 border-l-4 border-l-blue-500"><FileCheck/> {stats?.totalRepairOrders||0}</Card>
<Card className="p-6 border-l-4 border-l-red-500"><Trash2/> {stats?.totalDeletedCases||0}</Card>
</div>
<Card><table className="w-full text-sm"><thead><tr><th>Time</th><th>Type</th><th>Details</th></tr></thead>
<tbody>{stats?.logs.map(l=><tr key={l.id}><td>{l.timestamp.toLocaleString()}</td><td>{l.type}</td><td>{l.details}</td></tr>)}</tbody></table></Card>
<div className="text-xs text-gray-400 flex items-center"><Lock size={12}/> Read only logs</div>
</div>)};

export const AdminDataCenter=()=>{const[isExporting,setIsExporting]=useState(false);const[timeRange,setTimeRange]=useState("all");
return(<div className="p-6 max-w-2xl mx-auto space-y-6">
<h1 className="text-2xl font-bold">Data Center</h1>
<Card className="p-6">
<h3 className="text-lg font-bold flex items-center gap-2"><Database/> Complaints History</h3>
<div className="grid sm:grid-cols-2 gap-3 my-4">
{["today","week","month","year","all"].map(r=><label key={r}><input type="radio" checked={timeRange===r} onChange={()=>setTimeRange(r)}/> {r}</label>)}
</div>
<Button onClick={()=>{setIsExporting(true);setTimeout(()=>setIsExporting(false),1500)}}>{isExporting?"Preparing...":"Download CSV"}</Button>
</Card></div>)};

const AdminDashboard=()=>{const[complaints,setComplaints]=useState<Complaint[]>([]);
const[isRefreshing,setIsRefreshing]=useState(false);
const[activeTab,setActiveTab]=useState<"map"|"list"|"waiting">("map");
const[selectedComplaint,setSelectedComplaint]=useState<Complaint|null>(null);
const[timeFilter,setTimeFilter]=useState<"today"|"week"|"month"|"all">("month");

const fetchData=async()=>{setIsRefreshing(true);setComplaints(await api.getComplaints());setTimeout(()=>setIsRefreshing(false),500)};
useEffect(()=>{fetchData()},[]);

const handleStatusUpdate=async(id:string,s:ComplaintStatus)=>{if(s===ComplaintStatus.ASSIGNED)await api.logAdminActivity("REPAIR_ORDER",`Assigned ${id}`);
await api.updateComplaintStatus(id,s);setComplaints(p=>p.map(c=>c.id===id?{...c,status:s}:c));if(selectedComplaint?.id===id)setSelectedComplaint({...selectedComplaint,status:s})};

const handleDeleteCase=async(id:string)=>{if(confirm("Delete?")){await api.deleteComplaint(id);await api.logAdminActivity("DELETE_CASE",`Deleted ${id}`);setComplaints(p=>p.filter(c=>c.id!==id));setSelectedComplaint(null)}};

const filtered=complaints.filter(c=>{const d=new Date(c.timestamp),n=new Date();
if(timeFilter==="all")return true;if(timeFilter==="today")return d.toDateString()===n.toDateString();
if(timeFilter==="week")return d>new Date(n.getTime()-7*864e5);
if(timeFilter==="month")return d>new Date(n.getTime()-30*864e5);return true});

const pending=filtered.filter(c=>c.status===ComplaintStatus.WAITING_LIST).length;
const critical=filtered.filter(c=>c.severity===Severity.HIGH).length;
const repaired=filtered.filter(c=>c.status===ComplaintStatus.REPAIRED).length;

const viewData=activeTab==="waiting"?filtered.filter(c=>c.status===ComplaintStatus.WAITING_LIST):filtered;

return(<div className="p-6 space-y-6 h-full flex flex-col">
<h1 className="text-2xl font-bold">Command Center</h1>

<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
<StatCard title="Total" value={filtered.length} subtext={timeFilter} icon={BarChart3} colorClass={COLORS.primary} bgClass="bg-blue-50"/>
<StatCard title="Critical" value={critical} subtext="High" icon={Siren} colorClass={COLORS.alert} bgClass="bg-red-50"/>
<StatCard title="Pending" value={pending} subtext="Verify" icon={AlertCircle} colorClass="#FBC531" bgClass="bg-yellow-50"/>
<StatCard title="Repaired" value={repaired} subtext="Done" icon={CheckCircle2} colorClass={COLORS.secondary} bgClass="bg-green-50"/>
</div>

<div className="flex gap-6 h-full">
<div className="flex-1">
<div className="flex justify-between items-center">
<div className="flex gap-2">
<button onClick={()=>setActiveTab("map")}>Map</button>
<button onClick={()=>setActiveTab("list")}>List</button>
<button onClick={()=>setActiveTab("waiting")}>Waiting {pending}</button>
</div>
<div className="flex gap-2">
<select value={timeFilter} onChange={e=>setTimeFilter(e.target.value as any)}>
<option value="today">Today</option><option value="week">Week</option><option value="month">Month</option><option value="all">All</option>
</select>
<Button onClick={fetchData}><RefreshCw className={isRefreshing?"animate-spin":""}/></Button>
</div>
</div>

{activeTab==="map"?<RealMap complaints={filtered} selectedId={selectedComplaint?.id} onSelect={setSelectedComplaint} refreshTrigger={complaints.length}/>:
<table className="w-full text-sm"><tbody>{viewData.map(c=><tr key={c.id}><td>{c.id}</td><td>{c.address}</td><td><StatusBadge status={c.status}/></td><td>{c.severityScore}</td><td><Button onClick={()=>setSelectedComplaint(c)}>View</Button></td></tr>)}</tbody></table>}
</div>

<div className="w-96">
{selectedComplaint?<Card className="p-4">
<img src={selectedComplaint.imageUrl} className="w-full h-48 object-cover"/>
<p>ID:{selectedComplaint.id}</p>
<p>Score:{selectedComplaint.severityScore}</p>
<StatusBadge status={selectedComplaint.status}/>
{selectedComplaint.status===ComplaintStatus.WAITING_LIST&&<Button onClick={()=>handleStatusUpdate(selectedComplaint.id,ComplaintStatus.AUTO_VERIFIED)}>Verify</Button>}
{selectedComplaint.status===ComplaintStatus.AUTO_VERIFIED&&<Button onClick={()=>handleStatusUpdate(selectedComplaint.id,ComplaintStatus.ASSIGNED)}><HardHat/>Assign</Button>}
{selectedComplaint.status===ComplaintStatus.ASSIGNED&&<Button onClick={()=>handleStatusUpdate(selectedComplaint.id,ComplaintStatus.REPAIRED)}>Close</Button>}
<Button onClick={()=>handleDeleteCase(selectedComplaint.id)}><Trash2/>Delete</Button>
</Card>:<div>Select complaint</div>}
</div>
</div>
</div>)};

export default AdminDashboard;
