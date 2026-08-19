"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count, ready } = useCart();
  return <Link href="/carrinho">Carrinho{ready && count > 0 ? ` (${count})` : ""}</Link>;
}
