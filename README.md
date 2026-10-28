# Notion English Bridge

Private companion view for the shared Kota0 Notion page.

## How it works

- The server reads the shared page and its child pages through a Notion connection token.
- While the page is open, it checks Notion every 30 seconds and refreshes changed content.
- Desktop Chrome 138+ translates Japanese blocks to English on the user's device through the built-in Translator API. A language pack may download on first use. No translation API key is needed.
- The user writes in English, previews the Japanese translation, and explicitly posts it to the current Notion page. The team continues to use Notion in Japanese.
- The token lives in a Secure, HttpOnly, SameSite cookie in the user's browser. It is sent to this private Site for Notion API requests and is not saved in the site's source or database.

## Connect

1. Create a Notion internal connection with read and insert content capabilities.
2. Add that connection to the shared root page. Arrange this with the workspace owner if needed.
3. Open the private Site directly in desktop Chrome and sign in.
4. Paste the connection token in the setup screen. Do not put the token into source code or chat.
5. Click Enable English view. The first use may download language packs.

## Scope

The current view reads the shared root page and reachable child pages. It renders common text blocks, lists, headings, quotes, code, and child page links. Images and databases link back to Notion. Very large pages stop after 500 blocks. Posts append Japanese paragraphs to the current page; they do not edit existing sections. Refresh runs while the Site is open. Failed posts are never retried automatically; check Notion before trying again.

## Run locally

Use the Sites project setup and dependency installer, then run `npm run dev`. Local preview uses the starter's simulated ChatGPT sign-in. The production Site uses owner-private Sign in with ChatGPT.
