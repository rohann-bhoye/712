import React from 'react';

export default function Home() {
  const routes = [
    { method: 'POST', path: '/api/dev/auth/register', desc: 'Registers a new developer account' },
    { method: 'POST', path: '/api/dev/auth/login', desc: 'Authenticates credentials and returns JWT' },
    { method: 'POST', path: '/api/dev/providers/[providerId]/verify', desc: 'Validates & stores encrypted API keys' },
    { method: 'POST', path: '/api/dev/workspaces', desc: 'Provisions a new developer workspace' },
    { method: 'GET', path: '/api/dev/workspaces', desc: 'Queries active workspace session' },
    { method: 'POST', path: '/api/dev/chat', desc: 'Sends message & triggers background agent run' },
    { method: 'GET', path: '/api/dev/chat', desc: 'Fetches message history and active agent status' },
    { method: 'GET', path: '/api/dev/agent-jobs/[jobId]', desc: 'Gets execution events and logs timeline' },
    { method: 'POST', path: '/api/dev/agent-jobs/[jobId]/cancel', desc: 'Aborts active job runtime' },
    { method: 'POST', path: '/api/dev/agent-jobs/[jobId]/approve', desc: 'Direct Git commit/push of approved changes' },
    { method: 'POST', path: '/api/dev/agent-jobs/[jobId]/reject', desc: 'Discards updates and sets state to failed' },
    { method: 'GET', path: '/api/dev/history', desc: 'Returns historical workspace push logs' }
  ];

  return (
    <main className="min-h-screen bg-[#0B0F19] text-[#F3F4F6] p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Bucket<span className="text-[#00D8A4]">Dev</span>
            </h1>
            <p className="text-sm text-[#9CA3AF] mt-1">AI Coding Agent & Sandboxed Workspace Backend Gateway</p>
          </div>
          <div className="flex items-center gap-2 bg-[#064E3B] border border-[#059669] px-4 py-1.5 rounded-full">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs font-bold text-[#34D399] tracking-wider uppercase">Gateway Online</span>
          </div>
        </div>

        {/* Database Stats Card */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span> Database Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-[#1F2937] p-4 rounded-lg">
              <span className="text-[#9CA3AF] block mb-1">Target Database</span>
              <span className="font-mono text-[#00D8A4] font-semibold">bucketdev</span>
            </div>
            <div className="bg-[#1F2937] p-4 rounded-lg">
              <span className="text-[#9CA3AF] block mb-1">Active Architecture</span>
              <span className="font-semibold text-white">MongoDB Atlas Connection Pool</span>
            </div>
          </div>
        </div>

        {/* API Routes Table */}
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🔗</span> API Endpoint Router Map
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1F2937] text-xs font-bold text-[#9CA3AF] uppercase">
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Path</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937] text-sm">
                {routes.map((route, i) => (
                  <tr key={i} className="hover:bg-[#1F2937]/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        route.method === 'POST' ? 'bg-[#1E1B4B] text-[#818CF8]' : 'bg-[#064E3B] text-[#34D399]'
                      }`}>
                        {route.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-200">{route.path}</td>
                    <td className="py-3.5 px-4 text-[#9CA3AF]">{route.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
