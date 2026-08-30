<?xml version="1.0" encoding="UTF-8"?>
<!--
  Brutalist stylesheet for the files.jcrt.org sitemaps.

  Handles both document types with one file: <sitemapindex> (the root /sitemap.xml)
  and <urlset> (each per-folder sitemap). Browsers apply it via the
  <?xml-stylesheet?> processing instruction the generator writes into every sitemap;
  crawlers ignore it entirely and read the XML underneath.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">

  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, follow" />
        <title>
          <xsl:choose>
            <xsl:when test="sm:sitemapindex">Sitemap Index — files.jcrt.org</xsl:when>
            <xsl:otherwise>Sitemap — files.jcrt.org</xsl:otherwise>
          </xsl:choose>
        </title>
        <style>
          html {
            max-width: 70ch;
            padding: 3em 1em;
            margin: auto;
            line-height: 1.75;
            font-size: 1.25em;
          }

          html {
            background: #000;
            color: #fff;
          }

          body {
            margin: 0;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #000;
            color: #fff;
          }

          h1, h2, .mono {
            font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
            font-weight: normal;
          }

          h1 {
            font-size: 1.4em;
            margin: 0 0 .25em;
            text-transform: uppercase;
            letter-spacing: .04em;
          }

          h2 {
            font-size: 1em;
            margin: 2.5em 0 .5em;
            text-transform: uppercase;
            letter-spacing: .04em;
            border-bottom: 3px solid #fff;
            padding-bottom: .25em;
          }

          .meta {
            margin: 0 0 2em;
            color: #b9b9b9;
            font-size: .8em;
          }

          a {
            color: #fff;
            text-decoration: underline;
            text-underline-offset: .18em;
            overflow-wrap: anywhere;
          }

          a:hover,
          a:focus {
            background: #fff;
            color: #000;
            text-decoration: none;
            outline: none;
          }

          ol {
            margin: 0;
            padding: 0;
            list-style: none;
            counter-reset: row;
          }

          li {
            counter-increment: row;
            border-bottom: 1px solid #3a3a3a;
            padding: .5em 0;
            display: flex;
            gap: 1ch;
            align-items: baseline;
          }

          li::before {
            content: counter(row);
            font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
            font-weight: normal;
            color: #7d7d7d;
            font-size: .75em;
            min-width: 5ch;
            text-align: right;
            flex: 0 0 auto;
          }

          .entry {
            min-width: 0;
          }

          .lastmod {
            display: block;
            font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
            font-weight: normal;
            font-size: .7em;
            color: #9a9a9a;
          }

          footer {
            margin-top: 3em;
            padding-top: 1em;
            border-top: 3px solid #fff;
            font-size: .75em;
            color: #b9b9b9;
          }
        </style>
      </head>
      <body>
        <xsl:apply-templates select="sm:sitemapindex | sm:urlset" />
        <footer>
          <p>
            <a href="https://files.jcrt.org/sitemap.xml">files.jcrt.org/sitemap.xml</a>
            &#160;·&#160;
            <a href="https://jcrt.org/">Journal for Cultural and Religious Theory</a>
          </p>
        </footer>
      </body>
    </html>
  </xsl:template>

  <!-- Root index: a list of the per-folder sitemaps. -->
  <xsl:template match="sm:sitemapindex">
    <h1>Sitemap Index</h1>
    <p class="meta">
      <xsl:value-of select="count(sm:sitemap)" />
      <xsl:choose>
        <xsl:when test="count(sm:sitemap) = 1"><xsl:text> sitemap. It lists</xsl:text></xsl:when>
        <xsl:otherwise><xsl:text> sitemaps. Each lists</xsl:text></xsl:otherwise>
      </xsl:choose>
      <xsl:text> the files served under one directory of </xsl:text>
      <span class="mono">files.jcrt.org</span>
      <xsl:text>.</xsl:text>
    </p>
    <ol>
      <xsl:for-each select="sm:sitemap">
        <li>
          <span class="entry">
            <a href="{sm:loc}"><xsl:value-of select="sm:loc" /></a>
            <xsl:if test="sm:lastmod">
              <span class="lastmod">updated <xsl:value-of select="sm:lastmod" /></span>
            </xsl:if>
          </span>
        </li>
      </xsl:for-each>
    </ol>
  </xsl:template>

  <!-- A single folder sitemap: the files it contains. -->
  <xsl:template match="sm:urlset">
    <h1>Sitemap</h1>
    <p class="meta">
      <xsl:value-of select="count(sm:url)" />
      <xsl:choose>
        <xsl:when test="count(sm:url) = 1"><xsl:text> URL. </xsl:text></xsl:when>
        <xsl:otherwise><xsl:text> URLs. </xsl:text></xsl:otherwise>
      </xsl:choose>
      <a href="https://files.jcrt.org/sitemap.xml">Back to the sitemap index</a>
      <xsl:text>.</xsl:text>
    </p>
    <ol>
      <xsl:for-each select="sm:url">
        <li>
          <span class="entry">
            <a href="{sm:loc}"><xsl:value-of select="sm:loc" /></a>
            <xsl:if test="sm:lastmod">
              <span class="lastmod">updated <xsl:value-of select="sm:lastmod" /></span>
            </xsl:if>
          </span>
        </li>
      </xsl:for-each>
    </ol>
  </xsl:template>

</xsl:stylesheet>
