"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp,
  ExternalLink, Globe2, Languages, Loader2, LockKeyhole, RefreshCw,
  Send, ShieldCheck, Sparkles, Unplug,
} from "lucide-react";

const ROOT_ID = "3ea194a1c5628144b065cd9827f4173e";
const SOURCE_URL = "https://app.notion.com/p/Kota0-3ea194a1c5628144b065cd9827f4173e";

type Block = { id: string; type: string; text: string; edited: string; children?: Block[] };
type Page = { id: string; title: string; edited: string; url: string; blocks: Block[]; truncated: boolean };
type TranslatorInstance = { translate(text: string): Promise<string> };
type TranslatorClass = {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<TranslatorInstance>;
};

function translatorClass(): TranslatorClass | undefined {
  return (window as unknown as { Translator?: TranslatorClass }).Translator;
}
function flatten(blocks: Block[]): Block[] {
  return blocks.flatMap((block) => [block, ...flatten(block.children || [])]);
}
function clockTime(value: Date | null) {
  return value ? value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not checked yet";
}
function replyError(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

export default function BridgeClient({ connected, displayName }: { connected: boolean; displayName: string }) {
  const [notionConnected, setNotionConnected] = useState(connected);
  const [tokenInput, setTokenInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [pageId, setPageId] = useState(ROOT_ID);
  const [page, setPage] = useState<Page | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [englishEnabled, setEnglishEnabled] = useState(false);
  const [translationStatus, setTranslationStatus] = useState("");
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [showJapanese, setShowJapanese] = useState(false);
  const [english, setEnglish] = useState("");
  const [japanese, setJapanese] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const jaToEn = useRef<TranslatorInstance | null>(null);
  const enToJa = useRef<TranslatorInstance | null>(null);
  const cache = useRef(new Map<string, string>());

  const translatePage = useCallback(async (nextPage: Page) => {
    const instance = jaToEn.current;
    if (!instance) return;
    const candidates = [{ id: "title:" + nextPage.id, edited: nextPage.edited, text: nextPage.title },
      ...flatten(nextPage.blocks).map((block) => ({ id: block.id, edited: block.edited, text: block.text }))];
    let done = 0;
    for (const item of candidates) {
      if (!item.text.trim() || /^[\x00-\x7F\s]*$/.test(item.text)) continue;
      const key = item.id + ":" + item.edited + ":" + item.text;
      let value = cache.current.get(key);
      if (!value) {
        setTranslationStatus("Translating section " + (done + 1) + " of " + candidates.length + "...");
        try {
          value = await instance.translate(item.text);
          cache.current.set(key, value);
        } catch {
          setTranslationStatus("A section could not be translated. The Japanese original remains visible.");
          continue;
        }
      }
      setTranslated((previous) => ({ ...previous, [item.id]: value as string }));
      done++;
    }
    setTranslationStatus("");
  }, []);

  const refresh = useCallback(async (id: string, quiet = false) => {
    if (!notionConnected) return;
    if (!quiet) setPageLoading(true);
    try {
      const response = await fetch("/api/page?id=" + encodeURIComponent(id), { cache: "no-store" });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load page");
      setPage(data as Page);
      setLastChecked(new Date());
      setError("");
      void translatePage(data as Page);
    } catch (cause) {
      setError(replyError(cause, "Could not load the shared page"));
    } finally {
      setPageLoading(false);
    }
  }, [notionConnected, translatePage]);

  useEffect(() => {
    if (!notionConnected) return;
    void refresh(pageId);
    const timer = window.setInterval(() => void refresh(pageId, true), 30000);
    return () => window.clearInterval(timer);
  }, [notionConnected, pageId, refresh]);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect");
      setTokenInput("");
      setNotionConnected(true);
      setNotice("Connected. The shared page is loading.");
    } catch (cause) {
      setError(replyError(cause, "Could not connect"));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    const response = await fetch("/api/connect", { method: "DELETE" });
    if (!response.ok) { setError("Could not disconnect"); return; }
    setNotionConnected(false);
    setPage(null);
    setTranslated({});
    setEnglishEnabled(false);
    jaToEn.current = null;
    enToJa.current = null;
    setNotice("Notion disconnected from this browser.");
  }

  async function enableEnglish() {
    setError("");
    const Translator = translatorClass();
    if (!Translator) {
      setError("This browser does not support on-device translation. Open this site directly in desktop Chrome 138 or newer.");
      return;
    }
    try {
      const availability = await Translator.availability({ sourceLanguage: "ja", targetLanguage: "en" });
      if (availability === "unavailable") throw new Error("Japanese to English is unavailable in this browser.");
      setTranslationStatus(availability === "available" ? "Starting English view..." : "Downloading the language pack...");
      const instance = await Translator.create({
        sourceLanguage: "ja",
        targetLanguage: "en",
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event: Event) => {
            const progress = (event as Event & { loaded?: number }).loaded;
            if (typeof progress === "number") setTranslationStatus("Downloading the language pack: " + Math.round(progress * 100) + "%");
          });
        },
      });
      jaToEn.current = instance;
      setEnglishEnabled(true);
      setTranslationStatus("");
      if (page) void translatePage(page);
    } catch (cause) {
      setTranslationStatus("");
      setError(replyError(cause, "Could not start English translation"));
    }
  }

  async function previewJapanese() {
    if (!english.trim()) return;
    setPreviewing(true);
    setError("");
    setJapanese("");
    const Translator = translatorClass();
    if (!Translator) {
      setError("Open this site directly in desktop Chrome 138 or newer to translate your draft.");
      setPreviewing(false);
      return;
    }
    try {
      const availability = await Translator.availability({ sourceLanguage: "en", targetLanguage: "ja" });
      if (availability === "unavailable") throw new Error("English to Japanese is unavailable in this browser.");
      const instance = enToJa.current || await Translator.create({
        sourceLanguage: "en",
        targetLanguage: "ja",
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event: Event) => {
            const progress = (event as Event & { loaded?: number }).loaded;
            if (typeof progress === "number") setTranslationStatus("Downloading the language pack: " + Math.round(progress * 100) + "%");
          });
        },
      });
      enToJa.current = instance;
      const result = await instance.translate(english.trim());
      setJapanese(result);
      setTranslationStatus("");
    } catch (cause) {
      setError(replyError(cause, "Could not translate your draft"));
    } finally {
      setPreviewing(false);
    }
  }

  async function postJapanese() {
    if (!page || !japanese.trim() || posting) return;
    setPosting(true);
    setError("");
    try {
      const response = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, japanese, confirmed: true }),
      });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not post");
      setEnglish("");
      setJapanese("");
      setNotice("Posted to the shared Notion page in Japanese.");
      void refresh(page.id, true);
    } catch (cause) {
      setError(replyError(cause, "Post failed") + " Check Notion before trying again.");
    } finally {
      setPosting(false);
    }
  }

  function displayText(id: string, original: string) {
    return englishEnabled ? (translated[id] || original) : original;
  }

  function renderBlock(block: Block, depth = 0): React.ReactNode {
    const text = displayText(block.id, block.text);
    const isPage = block.type === "child_page";
    const isDatabase = block.type === "child_database";
    const isHeading = block.type.startsWith("heading_");
    const isList = block.type === "bulleted_list_item" || block.type === "numbered_list_item" || block.type === "to_do";
    const isCode = block.type === "code";
    const isDivider = block.type === "divider";
    return (
      <div key={block.id} className="block-wrap" style={{ marginLeft: Math.min(depth, 3) * 18 }}>
        {isDivider ? <hr className="content-divider" /> :
          isPage ? <button className="child-page" onClick={() => { setPageId(block.id.replace(/-/g, "")); setNotice(""); }}>
            <BookOpen size={18} /><span>{text}</span><ChevronRight size={17} />
          </button> :
          isDatabase ? <div className="unsupported"><BookOpen size={16} />Database: {text}. Open in Notion to view its rows.</div> :
          isHeading ? <h2 className={"content-heading " + block.type}>{text}</h2> :
          isList ? <div className="list-line"><span className="list-marker">{block.type === "to_do" ? "[ ]" : block.type === "numbered_list_item" ? "1." : "*"}</span><span>{text}</span></div> :
          isCode ? <pre className="code-block">{block.text}</pre> :
          block.type === "image" ? <div className="unsupported">Image: {text}. Open in Notion to view it.</div> :
          text ? <p className={block.type === "quote" ? "quote-block" : "content-text"}>{text}</p> : null}
        {showJapanese && translated[block.id] && !isCode && <p className="original-text" lang="ja">{block.text}</p>}
        {block.children?.map((child) => renderBlock(child, depth + 1))}
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>Bridge</strong><small>NOTION IN YOUR LANGUAGE</small></div></div>
        <div className="top-actions"><span className="private-badge"><LockKeyhole size={13} /> Private workspace</span><span className="user-pill">{displayName}</span></div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-section-label">WORKSPACE</div>
          <div className="workspace-name"><span className="workspace-icon">N</span><span><strong>Kota0</strong><small>Japanese source</small></span></div>
          <div className="sidebar-section-label nav-label">PAGES</div>
          <button className={"nav-item " + (pageId === ROOT_ID ? "active" : "")} onClick={() => setPageId(ROOT_ID)}><BookOpen size={16} /> Shared page</button>
          {pageId !== ROOT_ID && <button className="nav-item active" onClick={() => void refresh(pageId)}><ChevronRight size={16} /> Current subpage</button>}
          <div className="sidebar-footer">
            <div className="sync-card"><span className={"sync-dot " + (notionConnected ? "online" : "")} /><div><strong>{notionConnected ? "Notion connected" : "Connection needed"}</strong><small>{notionConnected ? "Checks every 30 seconds" : "Connect to read the page"}</small></div></div>
            <a className="source-link" href={SOURCE_URL} target="_blank" rel="noreferrer">Open original in Notion <ExternalLink size={13} /></a>
          </div>
        </aside>

        <section className="main-column">
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><span>{pageId === ROOT_ID ? "Shared page" : "Subpage"}</span></div>
          <div className="page-top">
            <div><span className="eyebrow">YOUR ENGLISH VIEW</span><h1>{page ? displayText("title:" + page.id, page.title) : "Understand the work, clearly."}</h1><p className="subtitle">Read the team's Notion page in English. Their original Japanese stays in Notion.</p></div>
            {notionConnected && <button className="icon-button" aria-label="Refresh now" onClick={() => void refresh(pageId)}><RefreshCw size={18} className={pageLoading ? "spin" : ""} /></button>}
          </div>

          {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">x</button></div>}
          {notice && <div className="alert success" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">x</button></div>}

          {!notionConnected ? <section className="setup-card">
            <div className="setup-icon"><ShieldCheck size={24} /></div>
            <span className="eyebrow">ONE-TIME SETUP</span>
            <h2>Connect your shared Notion page</h2>
            <p>Create a Notion internal connection with read and insert content access, then add it to the shared page. Paste its token here. It is kept in an HttpOnly cookie in your browser and sent only to this private site over HTTPS.</p>
            <div className="steps"><span><b>1</b> Create a Notion connection</span><span><b>2</b> Give it access to this page</span><span><b>3</b> Connect here</span></div>
            <label htmlFor="notion-token">Notion connection token</label>
            <div className="connect-row"><input id="notion-token" type="password" autoComplete="off" placeholder="Paste token" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} /><button className="primary-button" disabled={connecting || !tokenInput.trim()} onClick={connect}>{connecting ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} Connect</button></div>
            <a className="help-link" href="https://developers.notion.com/guides/get-started/quick-start" target="_blank" rel="noreferrer">Notion setup instructions <ExternalLink size={13} /></a>
          </section> : <>
            <div className="reading-toolbar">
              <div className="translation-state"><Globe2 size={17} /><span>{englishEnabled ? "English view on" : "Japanese original"}</span><i /></div>
              <div className="toolbar-actions">
                {englishEnabled && <label className="original-toggle"><input type="checkbox" checked={showJapanese} onChange={(event) => setShowJapanese(event.target.checked)} /> Show Japanese too</label>}
                {!englishEnabled && <button className="primary-button small" onClick={enableEnglish}><Languages size={16} /> Enable English view</button>}
                <span className="checked-at">Checked {clockTime(lastChecked)}</span>
              </div>
            </div>
            {translationStatus && <div className="translation-progress"><Loader2 size={15} className="spin" /> {translationStatus}</div>}
            <article className="document-card">
              {pageLoading && !page ? <div className="loading"><Loader2 size={22} className="spin" /> Loading Notion content...</div> : page ? <>
                {pageId !== ROOT_ID && <button className="back-link" onClick={() => setPageId(ROOT_ID)}><ArrowLeft size={15} /> Back to shared page</button>}
                <div className="document-meta"><span>NOTION PAGE</span><span>Updated {page.edited ? new Date(page.edited).toLocaleString() : "recently"}</span></div>
                <h2 className="document-title">{displayText("title:" + page.id, page.title)}</h2>
                {showJapanese && translated["title:" + page.id] && <p className="original-text" lang="ja">{page.title}</p>}
                <div className="document-rule" />
                {page.blocks.length ? page.blocks.map((block) => renderBlock(block)) : <p className="empty-note">This page has no blocks yet.</p>}
                {page.truncated && <div className="limit-note">This page is large. Open the original for content beyond the first 500 blocks.</div>}
              </> : <div className="loading">No page loaded.</div>}
            </article>
          </>}
        </section>

        <aside className="compose-column">
          <div className="compose-card">
            <div className="compose-heading"><span className="compose-icon"><Sparkles size={19} /></span><div><span className="eyebrow">WRITE NATURALLY</span><h2>Reply in English</h2></div></div>
            <p className="compose-intro">Your words become Japanese for the team. You review the translation before anything is posted.</p>
            <label htmlFor="english-draft">Your message</label>
            <textarea id="english-draft" placeholder="Write your update, question, or idea here..." value={english} disabled={!notionConnected} onChange={(event) => { setEnglish(event.target.value); setJapanese(""); }} maxLength={5000} />
            <div className="composer-count">{english.length} / 5,000</div>
            <button className="secondary-button" disabled={!notionConnected || !english.trim() || previewing} onClick={previewJapanese}>{previewing ? <Loader2 size={16} className="spin" /> : <Languages size={16} />} Translate and preview</button>
            {japanese && <div className="preview-box"><div className="preview-label"><span>JAPANESE PREVIEW</span><Check size={15} /></div><textarea lang="ja" className="japanese-edit" aria-label="Review or edit Japanese translation" value={japanese} onChange={(event) => setJapanese(event.target.value)} /><button className="primary-button post-button" disabled={posting} onClick={postJapanese}>{posting ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Post to Notion</button></div>}
            <div className="compose-foot"><ShieldCheck size={16} /><span>Only the Japanese text is posted. Your English draft stays in this browser.</span></div>
          </div>
          {notionConnected && <button className="disconnect" onClick={disconnect}><Unplug size={15} /> Disconnect this browser</button>}
          <div className="side-help"><CircleHelp size={17} /><p>Translation runs on your desktop browser. If the language pack is new, Chrome may download it once.</p></div>
        </aside>
      </div>
    </main>
  );
}
