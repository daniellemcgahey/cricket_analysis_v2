// src/utils/flags.js

export const normalizeName = (value) =>
  String(value || "").trim().toLowerCase();

/**
 * Map your cricket team/country labels to ISO 3166-1 alpha-2 country codes
 * used by FlagCDN.
 *
 * Example:
 * https://flagcdn.com/w320/ar.png
 */
export const TEAM_FLAG_CODES = {
  // Full Members / major teams
  "afghanistan": "af",
  "afghanistan men": "af",
  "afghanistan women": "af",

  "australia": "au",
  "australia men": "au",
  "australia women": "au",

  "bangladesh": "bd",
  "bangladesh men": "bd",
  "bangladesh women": "bd",

  "england": "gb",
  "england men": "gb",
  "england women": "gb",

  "india": "in",
  "india men": "in",
  "india women": "in",

  "ireland": "ie",
  "ireland men": "ie",
  "ireland women": "ie",

  "new zealand": "nz",
  "new zealand men": "nz",
  "new zealand women": "nz",

  "pakistan": "pk",
  "pakistan men": "pk",
  "pakistan women": "pk",

  "south africa": "za",
  "south africa men": "za",
  "south africa women": "za",

  "sri lanka": "lk",
  "sri lanka men": "lk",
  "sri lanka women": "lk",

  "west indies": "jm",
  "west indies men": "jm",
  "west indies women": "jm",

  "zimbabwe": "zw",
  "zimbabwe a women": "zw",
  "zimbabwe men": "zw",
  "zimbabwe women": "zw",

  // Americas
  "argentina": "ar",
  "argentina men": "ar",
  "argentina women": "ar",

  "bermuda": "bm",
  "bermuda men": "bm",
  "bermuda women": "bm",

  "brazil": "br",
  "brasil": "br",
  "brazil men": "br",
  "brazil women": "br",
  "brasil men": "br",
  "brasil women": "br",

  "canada": "ca",
  "canada men": "ca",
  "canada women": "ca",

  "cayman islands": "ky",
  "cayman islands men": "ky",
  "cayman islands women": "ky",

  "mexico": "mx",
  "mexico men": "mx",
  "mexico women": "mx",

  "united states": "us",
  "usa": "us",
  "usa men": "us",
  "usa women": "us",
  "united states of america men": "us",
  "united states of america women": "us",

  // Africa
  "botswana": "bw",
  "botswana men": "bw",
  "botswana women": "bw",

  "cameroon": "cm",
  "cameroon men": "cm",
  "cameroon women": "cm",

  "ghana": "gh",
  "ghana men": "gh",
  "ghana women": "gh",

  "kenya": "ke",
  "kenya men": "ke",
  "kenya women": "ke",

  "lesotho": "ls",
  "lesotho men": "ls",
  "lesotho women": "ls",

  "malawi": "mw",
  "malawi men": "mw",
  "malawi women": "mw",

  "mozambique": "mz",
  "mozambique men": "mz",
  "mozambique women": "mz",

  "namibia": "na",
  "namibia men": "na",
  "namibia women": "na",

  "nigeria": "ng",
  "nigeria men": "ng",
  "nigeria women": "ng",

  "rwanda": "rw",
  "rwanda men": "rw",
  "rwanda women": "rw",

  "sierra leone": "sl",
  "sierra leone men": "sl",
  "sierra leone women": "sl",

  "tanzania": "tz",
  "tanzania men": "tz",
  "tanzania women": "tz",

  "uganda": "ug",
  "uganda men": "ug",
  "uganda women": "ug",

  "zambia": "zm",
  "zambia men": "zm",
  "zambia women": "zm",

  // Europe
  "austria": "at",
  "austria men": "at",
  "austria women": "at",

  "belgium": "be",
  "belgium men": "be",
  "belgium women": "be",

  "croatia": "hr",
  "croatia men": "hr",
  "croatia women": "hr",

  "czech republic": "cz",
  "czechia": "cz",
  "czech republic men": "cz",
  "czech republic women": "cz",

  "denmark": "dk",
  "denmark men": "dk",
  "denmark women": "dk",

  "finland": "fi",
  "finland men": "fi",
  "finland women": "fi",

  "france": "fr",
  "france men": "fr",
  "france women": "fr",

  "germany": "de",
  "germany men": "de",
  "germany women": "de",

  "gibraltar": "gi",
  "gibraltar men": "gi",
  "gibraltar women": "gi",

  "guernsey": "gg",
  "guernsey men": "gg",
  "guernsey women": "gg",

  "italy": "it",
  "italy men": "it",
  "italy women": "it",

  "isle of man": "im",
  "isle of man men": "im",
  "isle of man women": "im",

  "jersey": "je",
  "jersey men": "je",
  "jersey women": "je",

  "netherlands": "nl",
  "netherlands men": "nl",
  "netherlands women": "nl",

  "norway": "no",
  "norway men": "no",
  "norway women": "no",

  "portugal": "pt",
  "portugal men": "pt",
  "portugal women": "pt",

  "romania": "ro",
  "romania men": "ro",
  "romania women": "ro",

  "scotland": "gb",
  "scotland men": "gb",
  "scotland women": "gb",

  "serbia": "rs",
  "serbia men": "rs",
  "serbia women": "rs",

  "spain": "es",
  "spain men": "es",
  "spain women": "es",

  "sweden": "se",
  "sweden men": "se",
  "sweden women": "se",

  "switzerland": "ch",
  "switzerland men": "ch",
  "switzerland women": "ch",

  // Asia
  "bahrain": "bh",
  "bahrain men": "bh",
  "bahrain women": "bh",

  "bhutan": "bt",
  "bhutan men": "bt",
  "bhutan women": "bt",

  "china": "cn",
  "china men": "cn",
  "china women": "cn",

  "hong kong": "hk",
  "hong kong men": "hk",
  "hong kong women": "hk",
  "hong kong, china": "hk",

  "indonesia": "id",
  "indonesia men": "id",
  "indonesia women": "id",

  "japan": "jp",
  "japan men": "jp",
  "japan women": "jp",

  "kuwait": "kw",
  "kuwait men": "kw",
  "kuwait women": "kw",

  "malaysia": "my",
  "malaysia men": "my",
  "malaysia women": "my",

  "maldives": "mv",
  "maldives men": "mv",
  "maldives women": "mv",

  "myanmar": "mm",
  "myanmar men": "mm",
  "myanmar women": "mm",

  "nepal": "np",
  "nepal men": "np",
  "nepal women": "np",

  "oman": "om",
  "oman men": "om",
  "oman women": "om",

  "philippines": "ph",
  "philippines men": "ph",
  "philippines women": "ph",

  "qatar": "qa",
  "qatar men": "qa",
  "qatar women": "qa",

  "saudi arabia": "sa",
  "saudi arabia men": "sa",
  "saudi arabia women": "sa",

  "singapore": "sg",
  "singapore men": "sg",
  "singapore women": "sg",

  "south korea": "kr",
  "korea": "kr",
  "south korea men": "kr",
  "south korea women": "kr",

  "thailand": "th",
  "thailand men": "th",
  "thailand women": "th",

  "united arab emirates": "ae",
  "uae": "ae",
  "uae men": "ae",
  "uae women": "ae",
  "united arab emirates men": "ae",
  "united arab emirates women": "ae",

  // East Asia-Pacific / Oceania
  "cook islands": "ck",
  "cook islands men": "ck",
  "cook islands women": "ck",

  "fiji": "fj",
  "fiji men": "fj",
  "fiji women": "fj",

  "papua new guinea": "pg",
  "papua new guinea men": "pg",
  "papua new guinea women": "pg",

  "samoa": "ws",
  "samoa men": "ws",
  "samoa women": "ws",

  "vanuatu": "vu",
  "vanuatu men": "vu",
  "vanuatu women": "vu",
};

export const getFlagCodeForTeam = (teamName) => {
  const normalized = normalizeName(teamName);
  return TEAM_FLAG_CODES[normalized] || null;
};

export const getFlagUrlForTeam = (teamName, width = 80) => {
  const code = getFlagCodeForTeam(teamName);
  if (!code) return null;
  return `https://flagcdn.com/w${width}/${code}.png`;
};