# ICONSIAM sales updates: import format

Used by `/ops/#/iconsiam/import` ("เพิ่มอัปเดตยอดขาย / Add sales update"). Official monthly
reports are entered in the report form (`#/new/consignment`) instead.

## Types

| Type | Coverage | Meaning |
|---|---|---|
| Month-to-date total (`snapshot`) | 1st of the month → "as of" date | Total sold so far this month. Replaces the previous total (10 then 16 means 16; stock moves by 6). |
| Sales for a date range (`interval`) | any dates inside one month | Only the sales in those dates. Ranges for the same product may not overlap unless the new one says which update it replaces. |
| Official report (`final`) | the report's period | Replaces interim figures for the same dates; the stock moves only by the difference. |

## Lines

CSV, one product per line (header optional): `code,qty,net[,description]`

```
code,qty,net
BN-SANTOS-200,3,1200
9000632784,2,800
```

JSON: `{"lines":[{"code":"BN-SANTOS-200","qty":3,"net":1200}]}`

`code` is our product code or the store's item code. Store codes are used only when the owner
has confirmed the mapping (`#/iconsiam/maps`); otherwise the wizard asks which product it is.
A barcode alone is never used to match. The figures above are format examples, not real sales.

## Duplicate guard

Every update has a reference (`source_ref`). Importing the same reference with the same figures
changes nothing; the same reference with different figures is refused. New data needs a new
reference. Nothing is saved until "Confirm and save" after the preview.

## Known conflicts in the delivery-form samples (October 2026)

- Document number is the placeholder 00000000 on both forms.
- Barcode 0090002791075 appears on Blue Magic (BA-008), Gediyo (BA-022), Cerrado (BA-015) and
  Florange (BA-020).
- Barcode 0090006751280 appears on both Whiskey (BA-009) and Colombia Supremo (BA-004).
- Gediyo is shown as 200 g; the website catalogue lists 100 g.
- Laos Bolaven is 420 on the form and 380 in the August sales report.
- Colombia Supremo has no product in the operations app; Vino Rosso has no barcode; 52 Hz has
  no store code or barcode.

All of these are flagged "needs review" in the code mappings; none is resolved automatically.
