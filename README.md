# Global Clinical Trials Tracker

A free public website for patients and everyday people to find clinical trials open to new participants worldwide, and to see how many studies are running by country, condition, phase and status. Available in English, Spanish and French.

## How it stays up to date

Every Monday a GitHub Actions job (`.github/workflows/update-and-deploy.yml`):

1. Downloads every study from the [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/api) (`scripts/fetch.py`).
2. Builds the data files the site reads, and compares study statuses with last week's snapshot to list status changes (`scripts/build.py`).
3. Publishes the site and its fresh data to GitHub Pages.

The data files are generated on each run and are not stored in this repository.

To refresh by hand: **Actions → Update data and publish site → Run workflow**.

## Files

- `site/index.html`, `site/app.js`: the pages, charts and trial finder
- `site/i18n.js`: interface text in English, Spanish and French
- `site/data-loader.js`: loads the weekly data files
- `scripts/`: the data download and build steps

## Disclaimer

For information only; not medical advice. Study details come from ClinicalTrials.gov; always confirm with the study team. This site is not affiliated with ClinicalTrials.gov.

## PreClinic Visit home page

`site/index.html` is branded as the PreClinic Visit "Find a clinical trial" home page, with links to the First Opinion, Early Insight and Second Opinion assessments on preclinicvisit.com.

- **Search box for other pages:** `site/widget.html` is a small "Find a clinical trial" search box to embed elsewhere (for example in a GoDaddy HTML section). Add `?lang=es` or `?lang=fr` to its address to fix the language.
- **Pre-filled links:** `index.html?q=asthma&country=Mexico&lang=es` opens the trial finder with those filters.
- **Ads:** ad spaces are off until `site/ads-config.js` has an AdSense publisher ID and ad-unit numbers. Ads never appear inside trial results.
