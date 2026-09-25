import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'Davomat — Smart Attendance',short_name:'Davomat',description:'Davomatni oson qayd etish terminali',start_url:'/terminal',display:'standalone',background_color:'#F8F7F3',theme_color:'#182D45',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]};}
