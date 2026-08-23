import React,{ Component } from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './execution.css';
import App from './App';

const pwaBundlePath=new URL(import.meta.url).pathname;
const pwaBase=pwaBundlePath.includes('/assets/')?pwaBundlePath.replace(/\/assets\/[^/]+$/,'').replace(/\/$/,''):'';
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(`${pwaBase}/sw.js`,{scope:`${pwaBase}/`}).catch(error=>console.warn('PWA service worker registration failed',error)));

function reportRootUiFailure(error, info) {
  const bundlePath = new URL(import.meta.url).pathname;
  const applicationBase = bundlePath.includes('/assets/')
    ? bundlePath.replace(/\/assets\/[^/]+$/, '').replace(/\/$/, '')
    : '';
  fetch(`${applicationBase}/api/ui-errors`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: String(error?.message || 'Unknown root UI error').slice(0, 500),
      stack: String(error?.stack || '').slice(0, 6000),
      componentStack: String(info?.componentStack || '').slice(0, 6000),
      page: 'application-root',
      path: window.location.href.slice(0, 1000),
      userAgent: navigator.userAgent.slice(0, 500),
    }),
  }).catch(() => {});
}

class AppErrorBoundary extends Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return{error};}
  componentDidCatch(error,info){console.error('PROJECTS UI failure',error,info);reportRootUiFailure(error,info);}
  render(){if(!this.state.error)return this.props.children;return <main dir="rtl" style={{minHeight:'100vh',display:'grid',placeContent:'center',padding:24,background:'#f5f6fa',fontFamily:'Arial'}}><section style={{maxWidth:520,padding:28,border:'1px solid #e1e4eb',borderRadius:18,background:'#fff',boxShadow:'0 20px 60px #1a1f331a'}}><h1 style={{marginTop:0}}>המסך נתקל בתקלה</h1><p>המידע נשמר. אפשר לטעון מחדש את הממשק ולהמשיך לעבוד.</p><button onClick={()=>location.reload()} style={{border:0,borderRadius:10,padding:'12px 20px',background:'#6957df',color:'#fff',fontWeight:700}}>טעינה מחדש</button><details style={{marginTop:18,color:'#777'}}><summary>פרטי תקלה</summary><code>{String(this.state.error?.message||'Unknown UI error')}</code></details></section></main>}
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
