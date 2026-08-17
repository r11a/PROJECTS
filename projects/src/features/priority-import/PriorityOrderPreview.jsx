import { AlertTriangle, BadgeCheck, FileSpreadsheet } from "lucide-react";
import { priorityMoney } from "./priorityImport";

function Fact({ label, value, money = false }) {
  if (value === undefined || value === null || value === "") return null;
  return <div><span>{label}</span><strong>{money ? priorityMoney.format(Number(value) || 0) : value}</strong></div>;
}

export function PriorityOrderPreview({ preview, mismatchConfirmed, onMismatchConfirmed, updateConfirmed, onUpdateConfirmed, onReviewExisting }) {
  const { order, project, duplicate, customerMismatch } = preview;
  return (
    <div className="priority-order-preview">
      <section className="priority-recognition-card">
        <header><span><FileSpreadsheet size={22} /></span><div><small>הזמנה שזוהתה בקובץ</small><h3>{order.priorityOrderNumber}</h3></div><BadgeCheck size={23} /></header>
        <div className="priority-facts">
          <Fact label="לקוח" value={order.customerName} />
          <Fact label="מס׳ לקוח Priority" value={order.priorityCustomerNumber} />
          <Fact label="איש קשר" value={order.contactName} />
          <Fact label="הצעת מחיר" value={order.quotationNumber} />
          <Fact label="סטטוס" value={order.orderStatus} />
          <Fact label="תאריך" value={order.orderDate} />
          <Fact label="פרטים" value={order.orderDescription} />
        </div>
      </section>
      {order.totalAmount !== undefined && <section className="priority-finance-strip">
        <Fact label="לפני הנחה" value={order.grossAmount} money />
        <Fact label="הנחה" value={`${order.discountPercent || 0}%`} />
        <Fact label="נטו" value={order.netAmount} money />
        <Fact label="מע״מ" value={order.vatAmount} money />
        <Fact label="סה״כ כולל מע״מ" value={order.totalAmount} money />
      </section>}
      {customerMismatch && <label className="priority-warning"><AlertTriangle size={20} /><span><strong>מספר הלקוח אינו תואם</strong>בפרויקט שמור {project.priorityCustomerNumber}, ובקובץ נמצא {order.priorityCustomerNumber}. ניתן להמשיך רק לאחר בדיקה ואישור.</span><input type="checkbox" checked={mismatchConfirmed} onChange={(event) => onMismatchConfirmed(event.target.checked)} />אישרתי את אי־ההתאמה</label>}
      {duplicate?.exists && <div className="priority-warning duplicate"><AlertTriangle size={20} /><span><strong>הזמנה זו כבר קיימת בפרויקט</strong>ייבוא מחדש יעדכן את ההזמנה הקיימת, יחליף את שורות הציוד ויחשב רק את הפרש שעות הייחוס.</span><button type="button" onClick={onReviewExisting}>צפייה בייבוא הקיים</button><label><input type="checkbox" checked={updateConfirmed} onChange={(event) => onUpdateConfirmed(event.target.checked)} />ייבוא מחדש ועדכון</label></div>}
    </div>
  );
}
