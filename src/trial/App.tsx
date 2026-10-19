import { matchRoute, usePath } from "./router";
import { Home } from "./pages/Home";
import { Order } from "./pages/Order";
import { ProductPage } from "./pages/Product";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Complete } from "./pages/Complete";
import { NotFound } from "./pages/NotFound";

export function TrialApp() {
  const path = usePath();
  const route = matchRoute(path, typeof location !== "undefined" ? location.search : "");
  switch (route.name) {
    case "home": return <Home />;
    case "order": return <Order key={route.slug ?? ""} slug={route.slug} />;
    case "product": return <ProductPage key={route.slug} slug={route.slug} />;
    case "cart": return <Cart />;
    case "checkout": return <Checkout />;
    case "complete": return <Complete />;
    default: return <NotFound />;
  }
}
