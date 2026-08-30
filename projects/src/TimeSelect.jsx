import { useMemo } from "react";

export function TimeSelect({ value = "", onChange, min = "00:00", max = "23:30", step = 30, allowEmpty = false, emptyLabel = "ללא שעה", ...props }) {
  const options = useMemo(() => {
    const toMinutes = (time) => { const [hours, minutes] = String(time).split(":").map(Number); return hours * 60 + minutes; };
    const values = [];
    for (let minutes = toMinutes(min); minutes <= toMinutes(max); minutes += step) {
      values.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
    }
    return values;
  }, [min, max, step]);
  return <select value={String(value || "").slice(0, 5)} onChange={onChange} {...props}>
    {allowEmpty && <option value="">{emptyLabel}</option>}
    {options.map((time) => <option key={time} value={time}>{time}</option>)}
  </select>;
}
