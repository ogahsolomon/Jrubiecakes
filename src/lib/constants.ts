export const SITE = {
  name: "Jrubiecakes",
  legalName: "Jrubiecakes Bakery",
  tagline:
    "Home of yummy tasty cakes with custom designs for all occasions, mouthwatering snacks and finger foods.",
  description:
    "Birthday cakes, children's cakes, cupcakes and delicious pastries made fresh for your special moments. Order online for delivery or pickup across Nigeria.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  phone: "+234 800 000 0000",
  whatsapp: "+234 800 000 0000",
  email: process.env.ADMIN_EMAIL ?? "orders@jrubiecakes.com",
  address: "Street No. 1, Durumi, Abuja 900103, Federal Capital Territory, Nigeria",
  hours: [
    { days: "Monday – Saturday", time: "9:00 AM – 6:00 PM" },
    { days: "Sunday", time: "Closed" },
  ],
  social: {
    instagram: "https://instagram.com/jrubiecakes",
    facebook: "https://facebook.com/jrubiecakes",
    tiktok: "https://tiktok.com/@jrubiecakes",
    twitter: "https://x.com/jrubiecakes",
  },
} as const;

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  "birthday-cakes": "Birthday Cakes",
  "childrens-cakes": "Children's Cakes",
  "custom-cakes": "Custom Cakes",
  cupcakes: "Cupcakes",
  "cake-loaf": "Cake Loaf",
  "uniced-cakes": "Uniced Cakes",
  donuts: "Donuts",
  "chin-chin": "Chin Chin",
  cookies: "Cookies",
  "small-chops": "Small Chops",
  "sausage-rolls": "Sausage Rolls",
  "fish-pies": "Fish Pies",
  "meat-pies": "Meat Pies",
  "other-pastries": "Other Pastries",
};
