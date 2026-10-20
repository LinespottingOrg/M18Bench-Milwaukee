import { createFileRoute } from "@tanstack/react-router";
import { BenchApp } from "@/components/bench/bench-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BenchApp />;
}
