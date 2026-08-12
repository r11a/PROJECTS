import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';

export function AddressAutocomplete({ api, value, onChange, onSelect, label = 'כתובת', required = false, className = '' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const query = String(value || '').trim();
    if (!open || query.length < 3) { setItems([]); setLoading(false); return undefined; }
    const currentRequest = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api(`/address-search?q=${encodeURIComponent(query)}`);
        if (currentRequest === requestId.current) setItems(result.addresses || []);
      } catch {
        if (currentRequest === requestId.current) setItems([]);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [api, open, value]);

  const choose = (item) => {
    onChange(item.address);
    onSelect?.(item);
    setItems([]);
    setOpen(false);
  };

  return <label className={`address-autocomplete ${className}`}>
    <span>{label}{required && <b>חובה</b>}<small>Photon · OpenStreetMap</small></span>
    <div className="address-input-shell"><MapPin size={17}/><input required={required} value={value} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder="התחילו להקליד רחוב, מספר ועיר" autoComplete="off"/>{loading && <LoaderCircle className="spin" size={16}/>}</div>
    {open && items.length > 0 && <div className="address-suggestions">{items.map((item) => <button type="button" key={item.placeId} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}><MapPin size={14}/><span>{item.address}{item.approximate&&<small>מיקום משוער ברחוב</small>}</span></button>)}</div>}
  </label>;
}
