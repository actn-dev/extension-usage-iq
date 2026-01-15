import { useEffect, useState } from "react";
import { getAuthManager } from "@src/utils/authManager";

interface Organization {
    id: string;
    name: string;
    slug: string;
}

interface OrganizationSelectorProps {
    onOrganizationSelected?: (org: Organization) => void;
}

export function OrganizationSelector({ onOrganizationSelected }: OrganizationSelectorProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        loadOrganizations();
    }, []);

    async function loadOrganizations() {
        try {
            setLoading(true);
            setError(null);
            
            const authManager = getAuthManager();
            
            // Fetch organizations
            const orgs = await authManager.getUserOrganizations();
            setOrganizations(orgs);

            // Get active organization
            const active = await authManager.getActiveOrganization();
            setActiveOrg(active);

            // Auto-select if only one organization
            if (orgs.length === 1 && !active) {
                await handleSelectOrganization(orgs[0]!);
            }
        } catch (err) {
            console.error("Failed to load organizations:", err);
            setError(err instanceof Error ? err.message : "Failed to load organizations");
        } finally {
            setLoading(false);
        }
    }

    async function handleSelectOrganization(org: Organization) {
        try {
            setSwitching(true);
            setError(null);

            const authManager = getAuthManager();
            const success = await authManager.setActiveOrganization(org.id, org.slug);

            if (success) {
                setActiveOrg(org);
                onOrganizationSelected?.(org);
            } else {
                setError("Failed to set active organization");
            }
        } catch (err) {
            console.error("Failed to select organization:", err);
            setError(err instanceof Error ? err.message : "Failed to select organization");
        } finally {
            setSwitching(false);
        }
    }

    if (loading) {
        return (
            <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading organizations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
                <button
                    onClick={loadOrganizations}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (organizations.length === 0) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">No Organizations Found</p>
                <p className="mt-1 text-sm text-yellow-700">
                    You need to be a member of an organization to use this extension.
                </p>
                <p className="mt-2 text-sm text-yellow-700">
                    Please visit <a href="https://dodily-nextjs.vercel.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">dodily.app</a> to create or join an organization.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">Select Organization</h3>
            
            {activeOrg && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                        <span className="font-medium">Active:</span> {activeOrg.name}
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {organizations.map((org) => (
                    <button
                        key={org.id}
                        onClick={() => handleSelectOrganization(org)}
                        disabled={switching || activeOrg?.id === org.id}
                        className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            activeOrg?.id === org.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{org.name}</p>
                                <p className="text-sm text-gray-600">@{org.slug}</p>
                            </div>
                            {activeOrg?.id === org.id && (
                                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {!activeOrg && (
                <p className="mt-3 text-sm text-gray-600 text-center">
                    Please select an organization to start tracking
                </p>
            )}
        </div>
    );
}
