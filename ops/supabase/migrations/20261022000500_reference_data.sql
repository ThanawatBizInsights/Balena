-- Balena operations: confirmed reference data only. No costs, no stock, no money balances:
-- those arrive through an opening-balance record once the partners agree the count.

-- on_hand only reads stock_moves, which every member can see; it needs no extra rights.
alter function public.on_hand(uuid, text) security invoker;

-- Foreign keys the app filters by.
create index documents_created_by on public.documents (created_by);
create index doc_lines_item on public.doc_lines (item_id);
create index partner_moves_member on public.partner_moves (member_id);
create index stock_moves_location on public.stock_moves (location_code);

insert into public.locations (code, name_th, name_en, kind) values
  ('CK', 'เจริญกรุง', 'Charoen Krung', 'own'),
  ('BY', 'บางใหญ่', 'Bang Yai', 'own'),
  ('ICS', 'ไอคอนสยาม', 'ICONSIAM', 'consignment'),
  ('TRANSIT', 'ระหว่างขนส่ง', 'In transit', 'transit');

-- Names only, never account numbers.
insert into public.accounts (code, name, holder, kind) values
  ('BANK-THANAWAT', 'Thanawat bank', 'Thanawat', 'bank'),
  ('BANK-TON', 'Ton bank', 'Ton', 'bank'),
  ('BANK-FRONK', 'Fronk bank', 'Fronk', 'bank'),
  ('CASH-CK', 'Charoen Krung shop cash', null, 'cash');

-- Online fees are unknown (planning range 15-30%), so they stay null until real settlement reports.
insert into public.channels (code, name, kind, fee_percent, fee_confirmed, settles_days) values
  ('SHOP-CK', 'Charoen Krung shop', 'shop', 0, true, 0),
  ('SHOPEE', 'Shopee', 'online', null, false, null),
  ('LAZADA', 'Lazada', 'online', null, false, null),
  ('LINESHOP', 'LINE SHOP', 'online', null, false, null),
  ('LINEOA', 'LINE OA', 'online', null, false, null),
  ('FACEBOOK', 'Facebook', 'online', null, false, null),
  ('GRAB', 'Grab', 'delivery', null, false, null),
  ('ICONSIAM', 'ICONSIAM', 'consignment', 25, true, 30);

-- Null = not agreed yet, so every such record waits for the owner's approval.
insert into public.settings (key, value, note) values
  ('purchase_approval_over', null, 'Purchases above this amount (THB) need approval'),
  ('expense_approval_over', null, 'Expenses above this amount (THB) need approval'),
  ('count_tolerance_units', null, 'Count differences above this need approval'),
  ('roast_loss_min_pct', null, 'Roast loss below this % needs approval'),
  ('roast_loss_max_pct', null, 'Roast loss above this % needs approval');

-- Products. size_confirmed = false where the size is the owner's default (200 g) rather than a label.
-- Product names are brand names and stay the same in Thai.
insert into public.stock_items (code, name_en, name_th, kind, base_unit, category, size_value, size_unit, pack, size_confirmed, iconsiam_code, barcode) values
  ('CB-SMOOTH-500', 'Cold Brew Concentrate Smooth Black 500 mL', 'Cold Brew Concentrate Smooth Black 500 มล.', 'product', 'pc', 'cold_brew', 500, 'mL', 'pouch', true, null, null),
  ('CB-ORIGINAL-500', 'Cold Brew Coffee Original 500 mL', 'Cold Brew Coffee Original 500 มล.', 'product', 'pc', 'cold_brew', 500, 'mL', 'pouch', true, null, null),
  ('CB-BRAZIL-BOTTLE', 'Brazil Cold Brew (bottle)', 'Brazil Cold Brew (ขวด)', 'product', 'pc', 'cold_brew', null, null, 'bottle', false, '9000632806', '0090006328062'),
  ('BN-SANTOS-200', 'Brazil Santos 200 g', 'Brazil Santos 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, '9000632784', '0090006327843'),
  ('BN-CERRADO-200', 'Brazil Cerrado 200 g', 'Brazil Cerrado 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, null, null),
  ('BN-BOLAVEN-200', 'Laos Bolaven 200 g', 'Laos Bolaven 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, '9000632801', '0090006328017'),
  ('BN-HOUSE-200', 'House Blends 200 g', 'House Blends 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, '9000632786', '0090006327867'),
  ('BN-KENYA-200', 'Kenya Muranga 200 g', 'Kenya Muranga 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, null, null),
  ('BN-MILKCHOC-200', 'Milk Choc 200 g', 'Milk Choc 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, '9000632790', '0090006327904'),
  ('BN-VINO-100', 'Vino Rosso 100 g', 'Vino Rosso 100 กรัม', 'product', 'pc', 'beans', 100, 'g', 'bag', true, null, null),
  ('BN-52HZ-200', '52 Hz. Signature Blend 200 g', '52 Hz. Signature Blend 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', true, null, null),
  ('BN-BLUEMAGIC-100', 'Blue Magic 100 g', 'Blue Magic 100 กรัม', 'product', 'pc', 'beans', 100, 'g', 'bag', true, null, null),
  ('BN-WHISKEY-100', 'Whiskey 100 g', 'Whiskey 100 กรัม', 'product', 'pc', 'beans', 100, 'g', 'bag', true, '9000675128', '0090006751280'),
  ('BN-DARKORANGE-200', 'Dark Orange 200 g', 'Dark Orange 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', false, '9000632802', '0090006328024'),
  ('BN-FLORANGE-200', 'Florange 200 g', 'Florange 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', false, '9000632803', '0090006328031'),
  ('BN-GEDIYO-200', 'Etiopia Gediyo 200 g', 'Etiopia Gediyo 200 กรัม', 'product', 'pc', 'beans', 200, 'g', 'bag', false, '9000632805', '0090006328055'),
  ('BN-ROBUSTA-150', 'Robusta 150 g', 'Robusta 150 กรัม', 'product', 'pc', 'beans', 150, 'g', 'bag', true, '9000675129', '0090006751297');

-- ICONSIAM shelf prices as printed on report P26081 (August 2026). Approved: they are on a real report.
insert into public.prices (item_id, channel_code, price, valid_from, status, source, approved_at)
select i.id, 'ICONSIAM', v.price, date '2026-08-01', 'approved', 'ICONSIAM report P26081', now()
from (values
  ('BN-SANTOS-200', 400.00), ('BN-HOUSE-200', 320.00), ('BN-MILKCHOC-200', 400.00), ('BN-BOLAVEN-200', 380.00),
  ('BN-DARKORANGE-200', 400.00), ('BN-FLORANGE-200', 400.00), ('BN-GEDIYO-200', 500.00), ('CB-BRAZIL-BOTTLE', 99.00),
  ('BN-WHISKEY-100', 450.00), ('BN-ROBUSTA-150', 300.00)
) as v(code, price)
join public.stock_items i on i.code = v.code;

-- Members are not in the repo (emails are personal). The owner row is inserted once in the
-- project; Ton and Fronk are added from the app when their sign-in emails are known.
