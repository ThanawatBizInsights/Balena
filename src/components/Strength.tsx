export function Strength() {
  return (
    <section className="section strength" aria-labelledby="strength-title">
      <h2 id="strength-title" className="section__title">ชอบเข้มหรือเบา ปรับได้</h2>
      <p className="section__body">
        เริ่มจากสูตรแนะนำแล้วชิม หากเข้มไปให้เติมน้ำหรือนมทีละน้อย หากอ่อนไปให้เพิ่ม Cold Brew ทีละน้อย
      </p>
      <div className="adjust">
        <div className="adjust__item">
          <p className="adjust__head">เข้มไป</p>
          <p>เติมน้ำหรือนมทีละน้อย แล้วชิมอีกครั้ง</p>
        </div>
        <div className="adjust__item">
          <p className="adjust__head">อ่อนไป</p>
          <p>เพิ่ม Cold Brew ทีละน้อย แล้วชิมอีกครั้ง</p>
        </div>
      </div>
      <p className="section__small">
        ปริมาณและสัดส่วนในสูตรคิดจากของเหลวก่อนใส่น้ำแข็ง เช่น Cold Brew 50 มล. ต่อน้ำหรือนม 100 มล.
        น้ำแข็งที่ละลายจะทำให้รสอ่อนลงเล็กน้อย
      </p>
    </section>
  );
}
