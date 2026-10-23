# Security

Please report a security problem privately, not in a public issue: on GitHub, open the repository's **Security** tab
and choose **Report a vulnerability**. Only the maintainer sees the report.

Useful things to include: what an attacker could do, the steps or a page that shows it, and the Tirekick version
(on the extensions page). Please don't test against real eBay or Facebook accounts other than your own.

Things worth reporting: anything that lets a web page read Tirekick's storage or API keys, send requests through
it, open links that skip `TKShared.safeUrl`, or get Tirekick to send data anywhere other than the AI service the
user chose and eBay's own search. The last review is in [`store/SECURITY-REVIEW.md`](store/SECURITY-REVIEW.md).

Fixes ship in the next Chrome Web Store update.
