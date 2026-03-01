export function getSeniorMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("seniorMode") === "true";
}

export function setSeniorMode(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("seniorMode", value ? "true" : "false");
}