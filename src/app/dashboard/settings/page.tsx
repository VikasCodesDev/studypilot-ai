"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/loading-skeleton";

interface Settings {
  theme: string;
  language: string;
  notifications: boolean;
  emailNotifications: boolean;
}

interface AIStatus {
  groq: boolean;
  gemini: boolean;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings);
      setAIStatus(data.aiStatus);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (user) setName(user.name); }, [user]);

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...settings }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-8">⚙️ Settings</h1>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
        <p className="text-text-secondary mt-1">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Full Name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Email</label>
              <input
                type="email" value={user?.email || ""} disabled
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-secondary cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-text-secondary">Receive in-app notifications</p>
              </div>
              <button
                onClick={() => setSettings((s) => s ? { ...s, notifications: !s.notifications } : s)}
                className={`w-12 h-6 rounded-full transition-colors ${settings?.notifications ? "bg-emerald-500" : "bg-surface-hover"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings?.notifications ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-text-secondary">Receive email updates</p>
              </div>
              <button
                onClick={() => setSettings((s) => s ? { ...s, emailNotifications: !s.emailNotifications } : s)}
                className={`w-12 h-6 rounded-full transition-colors ${settings?.emailNotifications ? "bg-emerald-500" : "bg-surface-hover"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings?.emailNotifications ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Language</label>
              <select
                value={settings?.language || "en"}
                onChange={(e) => setSettings((s) => s ? { ...s, language: e.target.value } : s)}
                className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-text-primary focus:outline-none focus:border-emerald-500/50"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Provider Status */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">AI Provider Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-lg">🤖</span>
                <div>
                  <p className="text-sm font-medium">Groq API</p>
                  <p className="text-xs text-text-secondary">Primary AI provider</p>
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full ${aiStatus?.groq ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {aiStatus?.groq ? "Configured" : "Not Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-lg">✨</span>
                <div>
                  <p className="text-sm font-medium">Google Gemini</p>
                  <p className="text-xs text-text-secondary">Fallback AI provider</p>
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full ${aiStatus?.gemini ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {aiStatus?.gemini ? "Configured" : "Not Configured"}
              </span>
            </div>
            {!aiStatus?.groq && !aiStatus?.gemini && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-2">
                <p className="text-xs text-amber-400">
                  ⚠️ No AI providers configured. Set GROQ_API_KEY or GOOGLE_GEMINI_API_KEY in your environment variables to enable AI features.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Account Security */}
        <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle">
          <h3 className="font-semibold mb-4">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Account Provider</p>
                <p className="text-xs text-text-secondary">{user?.email}</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Email</span>
            </div>
          </div>
        </div>

        {/* Save & Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={logout} className="px-6 py-2.5 rounded-xl border border-rose-500/20 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
