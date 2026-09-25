import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'ARK Education Smart Attendance',short_name:'ARK Davomat',description:'ARK Education davomat terminali',start_url:'/terminal',display:'standalone',background_color:'#F8F7F3',theme_color:'#182D45',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]};}
