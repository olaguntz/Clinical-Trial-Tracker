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
