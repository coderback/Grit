# National table releases kept here

Health Canada's and Fineli's sites refuse requests from servers (a dropped
connection and a bot check), so these two releases were downloaded in a
browser and are kept in the repository, unchanged. The importers check each
file's SHA-256 before reading it, so a changed or truncated file is never
imported as the release it claims to be. CIQUAL isn't kept here: the importer
downloads it from Recherche Data Gouv, which answers servers.

| File                                 | What it is                                                                 | From                                                                                                                                                         | SHA-256                                                            | Licence                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `cnf-fcen-csv.zip`                   | Canadian Nutrient File 2015, full database, CSV (Health Canada)            | [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-2015-download-files.html) | `fb77503d88186844cc2c27b39432d755505f97a789c97fc5973a30d0cd4b0367` | Open Government Licence – Canada; credit Health Canada                       |
| `Fineli_Rel20_74_ravintotekijaa.zip` | Fineli release 20, basic package 2 (74 components) (THL), renamed to ASCII | [Fineli open data](https://fineli.fi/fineli/en/avoin-data)                                                                                                   | `e7e6bd8d4b9261d751229e763dad436b297d36d48fe853faf49e1fd2a116d262` | CC BY 4.0; credit the Finnish Institute for Health and Welfare (THL), Fineli |

Both were downloaded on 7 November 2026. To update one, download the new
release in a browser, replace the file (keep the name, or change the name
and the constant in `src/sources/cnf.ts` or `src/sources/fineli.ts`),
update its SHA-256 there and here, and run the tests: they read the whole
file.
