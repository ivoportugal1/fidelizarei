"use client";

export function AdminLogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return <button className="button button-light" onClick={logout}>Sair</button>;
}
