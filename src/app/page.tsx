"use client";

import { useMemo, useState } from "react";
import { toolCategories, tools } from "@/config/tools";

export default function Home() {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return tools;
    }

    return tools.filter((tool) => {
      const searchableText = [
        tool.name,
        tool.description,
        tool.category,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [query]);

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-cyan-200/10 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-300">
                TGPM Property Management
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                TGPM Armory
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                A focused launchpad for internal leasing, maintenance,
                resident, and budgeting workflows.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
              {toolCategories.map((category) => (
                <div
                  key={category}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <p className="text-sm font-medium text-slate-200">
                    {category}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {
                      tools.filter((tool) => tool.category === category)
                        .length
                    }{" "}
                    tools
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="py-5">
          <label
            htmlFor="tool-search"
            className="text-sm font-medium text-slate-300"
          >
            Search tools
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="tool-search"
              type="search"
              suppressHydrationWarning
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, description, or category"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            />
            <p className="shrink-0 text-sm text-slate-400">
              {filteredTools.length} of {tools.length} tools
            </p>
          </div>
        </section>

        <section className="flex-1 pb-8">
          <div className="space-y-8">
            {toolCategories.map((category) => {
              const categoryTools = filteredTools.filter(
                (tool) => tool.category === category,
              );

              if (categoryTools.length === 0) {
                return null;
              }

              return (
                <div key={category}>
                  <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                    <h2 className="text-lg font-semibold text-white">
                      {category}
                    </h2>
                    <span className="text-sm text-slate-400">
                      {categoryTools.length}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryTools.map((tool) => (
                      <article
                        key={tool.name}
                        className="flex min-h-48 flex-col justify-between rounded-lg border border-white/10 bg-[#101d31] p-5 shadow-lg shadow-black/15"
                      >
                        <div>
                          <p className="text-xs font-semibold uppercase text-amber-300">
                            {tool.category}
                          </p>
                          <h3 className="mt-3 text-xl font-semibold text-white">
                            {tool.name}
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-slate-300">
                            {tool.description}
                          </p>
                        </div>

                        <a
                          href={tool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:ring-offset-2 focus:ring-offset-[#101d31]"
                        >
                          Open Tool
                        </a>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTools.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/20 px-5 py-12 text-center">
              <h2 className="text-xl font-semibold text-white">
                No tools found
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Try a different name, workflow, or category.
              </p>
            </div>
          ) : null}
        </section>

        <footer className="border-t border-white/10 py-5 text-center text-sm text-slate-400">
          TGPM Internal Tools
        </footer>
      </div>
    </main>
  );
}
