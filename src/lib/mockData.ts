export interface Ad {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: "New" | "Used" | "Refurbished";
  location: string;
  images: string[];
  seller: {
    name: string;
    avatar: string;
    rating: number;
    joinedDate: string;
    totalAds: number;
  };
  createdAt: string;
  featured?: boolean;
}

export const categories = [
  { name: "Vehicles", icon: "🚗", count: 12450 },
  { name: "Property", icon: "🏠", count: 8930 },
  { name: "Electronics", icon: "💻", count: 23100 },
  { name: "Fashion", icon: "👗", count: 15670 },
  { name: "Phones & Tablets", icon: "📱", count: 31200 },
  { name: "Home & Garden", icon: "🌿", count: 9870 },
  { name: "Services", icon: "🔧", count: 6540 },
  { name: "Jobs", icon: "💼", count: 4320 },
  { name: "Agriculture", icon: "🌾", count: 2100 },
  { name: "Others", icon: "📦", count: 7890 },
];

export const conditions = ["New", "Used", "Refurbished"] as const;

export const mockAds: Ad[] = [
  {
    id: "1",
    title: "iPhone 15 Pro Max 256GB - Natural Titanium",
    description: "Brand new, sealed in box. Purchased from Apple Store. Includes warranty. International shipping available.",
    price: 1099,
    category: "Phones & Tablets",
    condition: "New",
    location: "New York, USA",
    images: [
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800",
    ],
    seller: { name: "TechDeals", avatar: "", rating: 4.8, joinedDate: "2023-06-15", totalAds: 48 },
    createdAt: "2026-05-01",
    featured: true,
  },
  {
    id: "2",
    title: "2022 Tesla Model 3 Long Range - White",
    description: "Excellent condition, 18,000 miles. Full self-driving capability. One owner, all service records available.",
    price: 32500,
    category: "Vehicles",
    condition: "Used",
    location: "Los Angeles, USA",
    images: [
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800",
    ],
    seller: { name: "AutoWorld", avatar: "", rating: 4.9, joinedDate: "2022-01-10", totalAds: 124 },
    createdAt: "2026-04-28",
    featured: true,
  },
  {
    id: "3",
    title: "MacBook Pro 16\" M3 Max - Space Black",
    description: "Like new, barely used. 36GB RAM, 1TB SSD. Perfect for professionals.",
    price: 2899,
    category: "Electronics",
    condition: "Used",
    location: "London, UK",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
    ],
    seller: { name: "GadgetHub", avatar: "", rating: 4.7, joinedDate: "2023-03-20", totalAds: 67 },
    createdAt: "2026-05-03",
  },
  {
    id: "4",
    title: "3 Bedroom Apartment - City Center",
    description: "Spacious 3BR apartment with modern finishes. Great views, parking included. Available immediately.",
    price: 185000,
    category: "Property",
    condition: "New",
    location: "Dubai, UAE",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    ],
    seller: { name: "DubaiHomes", avatar: "", rating: 4.6, joinedDate: "2024-01-05", totalAds: 35 },
    createdAt: "2026-05-02",
    featured: true,
  },
  {
    id: "5",
    title: "Nike Air Jordan 1 Retro High OG - Size 10",
    description: "Deadstock, never worn. Comes with original box and receipt. Authentic guaranteed.",
    price: 220,
    category: "Fashion",
    condition: "New",
    location: "Toronto, Canada",
    images: [
      "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800",
    ],
    seller: { name: "SneakerKing", avatar: "", rating: 4.5, joinedDate: "2023-09-12", totalAds: 89 },
    createdAt: "2026-04-30",
  },
  {
    id: "6",
    title: "Samsung 65\" OLED 4K Smart TV",
    description: "2025 model. Incredible picture quality. Wall mount included. Original packaging.",
    price: 1450,
    category: "Electronics",
    condition: "New",
    location: "Berlin, Germany",
    images: [
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
    ],
    seller: { name: "ElectroShop", avatar: "", rating: 4.4, joinedDate: "2024-07-01", totalAds: 22 },
    createdAt: "2026-05-04",
  },
  {
    id: "7",
    title: "Professional Web Development Services",
    description: "Full-stack developer available for hire. React, Node.js, blockchain. 5+ years experience.",
    price: 75,
    category: "Services",
    condition: "New",
    location: "Worldwide",
    images: [
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800",
    ],
    seller: { name: "DevPro", avatar: "", rating: 5.0, joinedDate: "2022-11-20", totalAds: 12 },
    createdAt: "2026-05-05",
  },
  {
    id: "8",
    title: "Organic Coffee Farm - 5 Hectares",
    description: "Producing farm with established coffee plants. Includes processing equipment and storage facilities.",
    price: 45000,
    category: "Agriculture",
    condition: "Used",
    location: "Kampala, Uganda",
    images: [
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800",
    ],
    seller: { name: "FarmConnect", avatar: "", rating: 4.3, joinedDate: "2024-02-14", totalAds: 8 },
    createdAt: "2026-04-29",
  },
];
