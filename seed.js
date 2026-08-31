/**
 * Loads demo listings into DynamoDB so the landing page is not empty during
 * the presentation. Safe to run more than once (each run adds new IDs).
 *
 *   AWS_REGION=us-east-1 DDB_TABLE=RealEstate-Listings npm run seed
 */

import { putListing } from "./lib/db.js";

const listings = [
  {
    category: "property",
    title: "4-bedroom villa with sea view, Jazeera Road",
    description:
      "Newly finished villa 300m from the beach. Fenced compound, borehole water, solar backup and parking for three cars.",
    price: 185000,
    currency: "USD",
    city: "Mogadishu",
    district: "Abdiaziz",
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 420,
    contactName: "Faduma H.",
    contactPhone: "+252 61 555 0142",
  },
  {
    category: "property",
    title: "Ground-floor shop, Bakaara market edge",
    description:
      "Sixty square metre retail unit on a paved street with generator line already installed. Suits a pharmacy or electronics shop.",
    price: 900,
    currency: "USD",
    city: "Mogadishu",
    district: "Howlwadaag",
    areaSqm: 60,
    contactName: "Abdirahman O.",
    contactPhone: "+252 61 555 0198",
  },
  {
    category: "property",
    title: "2-bedroom apartment, Taleex Street",
    description:
      "Second floor, tiled throughout, shared water tank, walking distance to two schools. Monthly rent, six months in advance.",
    price: 450,
    currency: "USD",
    city: "Mogadishu",
    district: "Hodan",
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 110,
    contactName: "Sagal M.",
    contactPhone: "+252 61 555 0231",
  },
  {
    category: "property",
    title: "Warehouse near the port, 800 sqm",
    description:
      "Steel-frame warehouse with 24-hour guard post and container-height loading door. Twelve minutes from the port gate.",
    price: 2400,
    currency: "USD",
    city: "Mogadishu",
    district: "Xamar Jajab",
    areaSqm: 800,
    contactName: "Yusuf A.",
    contactPhone: "+252 61 555 0177",
  },
  {
    category: "property",
    title: "Family house with garden, Kismayo",
    description:
      "Three bedrooms on a 500 sqm plot with mature papaya and lime trees. Registered title deed available for inspection.",
    price: 74000,
    currency: "USD",
    city: "Kismayo",
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 500,
    contactName: "Hodan I.",
    contactPhone: "+252 61 555 0265",
  },
  {
    category: "vehicle",
    title: "Toyota Land Cruiser Prado 2016",
    description:
      "One owner since import, full service record, new tyres in June. Diesel, four-wheel drive, air conditioning working well.",
    price: 32500,
    currency: "USD",
    city: "Mogadishu",
    district: "Wadajir",
    make: "Toyota",
    model: "Land Cruiser Prado",
    year: 2016,
    mileageKm: 118000,
    fuel: "Diesel",
    contactName: "Mohamed D.",
    contactPhone: "+252 61 555 0119",
  },
  {
    category: "vehicle",
    title: "Toyota Noah 2012, 7 seats",
    description:
      "Reliable family van, automatic, petrol. Body straight, no accident history. Perfect for school runs or taxi work.",
    price: 9800,
    currency: "USD",
    city: "Mogadishu",
    make: "Toyota",
    model: "Noah",
    year: 2012,
    mileageKm: 205000,
    fuel: "Petrol",
    contactName: "Ismail K.",
    contactPhone: "+252 61 555 0154",
  },
  {
    category: "vehicle",
    title: "Isuzu NPR 3-tonne truck, 2010",
    description:
      "Working truck currently on daily delivery contracts. Engine rebuilt last year, new clutch, ready to transfer.",
    price: 15200,
    currency: "USD",
    city: "Baidoa",
    make: "Isuzu",
    model: "NPR",
    year: 2010,
    mileageKm: 310000,
    fuel: "Diesel",
    contactName: "Nuurto S.",
    contactPhone: "+252 61 555 0288",
  },
  {
    category: "vehicle",
    title: "Nissan Sunny 2014, low mileage",
    description:
      "Small saloon kept in a covered compound. Fuel efficient, cheap parts, good first car for a young professional.",
    price: 6400,
    currency: "USD",
    city: "Hargeisa",
    make: "Nissan",
    model: "Sunny",
    year: 2014,
    mileageKm: 88000,
    fuel: "Petrol",
    contactName: "Layla A.",
    contactPhone: "+252 63 555 0102",
  },
  {
    category: "vehicle",
    title: "Bajaj three-wheeler, 2021",
    description:
      "Registered bajaj in daily service on the Hodan route. Papers clean, seller moving abroad so selling quickly.",
    price: 2750,
    currency: "USD",
    city: "Mogadishu",
    district: "Hodan",
    make: "Bajaj",
    model: "RE",
    year: 2021,
    mileageKm: 42000,
    fuel: "Petrol",
    contactName: "Cabdi W.",
    contactPhone: "+252 61 555 0303",
  },
];

async function main() {
  let ok = 0;
  for (const listing of listings) {
    const saved = await putListing(listing);
    console.log(`+ ${saved.category.padEnd(8)} ${saved.listingId}  ${saved.title}`);
    ok++;
  }
  console.log(`\nSeeded ${ok} listings into ${process.env.DDB_TABLE || "RealEstate-Listings"}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
