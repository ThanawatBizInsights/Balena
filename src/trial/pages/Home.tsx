import { products } from "../data/products";
import { Link, useTitle } from "../router";
import { Showcase } from "../components/Showcase";
import { ProductImg, Shell, accentStyle } from "../components/ui";

const pouch = products.find((p) => p.slug === "cold-brew-concentrate-smooth-black")!;
const original = products.find((p) => p.slug === "cold-brew-coffee-original")!;
const coldBrew = products.filter((p) => p.category === "cold-brew");
const beans = products.filter((p) => p.category === "beans");

export function Home() {
  useTitle("ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู");
  return (
    <Shell>
      {/* Hero: the pouch in front of an oversized COLD BREW, the approved hooks below. */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__band" aria-hidden="true" />
        <p className="hero__giant" aria-hidden="true" lang="en"><span>COLD</span><span>BREW</span></p>
        <div className="hero__pouch">
          <ProductImg img={pouch.images[0]} eager sizes="(min-width: 900px) 34vw, 70vw" />
        </div>
        <div className="hero__copy">
          <h1 id="hero-title" className="hero__th">ชงง่ายที่บ้าน<br />เข้มอร่อยได้ทุกเมนู</h1>
          <p className="hero__en" lang="en">Your everyday coffee, made at home</p>
          <div className="hero__ctas">
            <a className="btn btn--cream" href="#cold-brew">เลือกซื้อโคลด์บรูว์</a>
            <a className="btn btn--ghost" href="#beans">เลือกเมล็ดกาแฟ</a>
          </div>
        </div>
      </section>

      <Showcase items={products} title="เลือกกาแฟของคุณ" id="lineup" />

      {/* Cold brew */}
      <section className="cat cat--navy" id="cold-brew" aria-labelledby="cb-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Cold Brew</p>
            <h2 id="cb-title" className="h-th">โคลด์บรูว์</h2>
            <p className="cat__lead">ถุง 500 มล. พร้อมจุกเท เก็บในตู้เย็นแล้วชงได้ทุกวัน</p>
          </div>
          <ul className="pouches">
            {coldBrew.map((p) => (
              <li key={p.id} style={accentStyle(p)}>
                <Link to={`/trial/products/${p.slug}`} className="pouch-card">
                  <span className="pouch-card__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 30vw, 80vw" /></span>
                  <span className="pouch-card__name" lang="en">{p.name}</span>
                  <span className="pouch-card__sub" lang="en">{p.subtitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Beans: a shelf of bags, each on its own label colour */}
      <section className="cat cat--cream" id="beans" aria-labelledby="beans-title">
        <div className="cat__in">
          <div className="cat__head">
            <p className="kicker" lang="en">Coffee Beans</p>
            <h2 id="beans-title" className="h-th">เมล็ดกาแฟ</h2>
            <p className="cat__lead">{beans.length} ตัว คั่วเป็นเมล็ด (Whole Bean) ขนาด 200 กรัม และ 100 กรัม</p>
          </div>
          <ul className="shelf">
            {beans.map((p) => (
              <li key={p.id} style={accentStyle(p)}>
                <Link to={`/trial/products/${p.slug}`} className="shelf__item">
                  <span className="shelf__img"><ProductImg img={p.images[0]} sizes="(min-width: 900px) 18vw, 40vw" /></span>
                  <span className="shelf__name" lang="en">{p.name}</span>
                  <span className="shelf__notes" lang="en">{p.attributes.find((a) => a.label === "Taste notes")?.value}</span>
                  <span className="shelf__size">{p.variants.map((v) => v.label).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Coffee at home */}
      <section className="home-brew" aria-labelledby="hb-title">
        <div className="home-brew__photo"><ProductImg img={original.images[0]} sizes="(min-width: 900px) 40vw, 90vw" /></div>
        <div className="home-brew__text">
          <p className="kicker" lang="en">Coffee at home</p>
          <h2 id="hb-title" className="h-th">กาแฟแก้วโปรด<br />ไม่ต้องออกจากบ้าน</h2>
          <p>เปิดตู้เย็น เทโคลด์บรูว์ แล้วเลือกว่าวันนี้อยากได้แก้วไหน</p>
          <div className="uses">
            <div className="use">
              <h3>กาแฟดำเย็น</h3>
              <p>เติมน้ำเย็นและน้ำแข็ง ได้กาแฟดำรสชัด</p>
            </div>
            <div className="use">
              <h3>กาแฟนมเย็น</h3>
              <p>เติมนมสดหรือนมพืชที่ชอบ ได้แก้วนุ่มกลมกล่อม</p>
            </div>
          </div>
          <p className="small">น้ำ นม และน้ำแข็งไม่ได้รวมอยู่ในถุง สัดส่วนเริ่มต้นและวิธีชงทีละขั้นดูได้ที่หน้าวิธีชง</p>
          <a className="btn btn--navy" href="/cold-brew-recipes/">ดูวิธีชง Cold Brew</a>
        </div>
      </section>

      {/* To the order page */}
      <section className="order-cta" aria-labelledby="oc-title">
        <p className="order-cta__giant" aria-hidden="true" lang="en">ORDER</p>
        <h2 id="oc-title" className="h-th">พร้อมเลือกแล้วใช่ไหม</h2>
        <Link to="/trial/order" className="btn btn--cream btn--big">ไปหน้าสั่งซื้อ</Link>
      </section>
    </Shell>
  );
}
