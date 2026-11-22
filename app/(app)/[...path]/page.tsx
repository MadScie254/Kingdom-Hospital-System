"use client";
import { use } from "react";
import { ResourcePage } from "@/components/resource";

export default function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = use(params);
  return <ResourcePage k={path.join("/")} />;
}
