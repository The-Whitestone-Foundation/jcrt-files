# JCRT PDF Accessibility Audit

**Date**: 2026-03-21  
**Tool**: [simplA11yPDFCrawler](https://github.com/accessibility-luxembourg/simplA11yPDFCrawler)  
**Scope**: All PDF files in `jcrt-files/`  
**Language fix applied**: All PDFs updated to `/Lang = en` before this scan  

## Summary

| Metric | Count | % |
|---|---|---|
| **Total PDFs scanned** | 705 | 100% |
| Fully accessible | 58 | 8% |
| Totally inaccessible | 0 | 0% |
| Not accessible (has issues) | 647 | 91% |

## Test Results

| Test | Fail | Pass | Description |
|---|---|---|---|
| **Tagged** | 646 | 59 | Is the document tagged for assistive tech? |
| **Title** | 646 | 59 | Has a title with DisplayDocTitle set? (WCAG 2.4.2) |
| **Language** | 0 | 705 | Has a valid default language? (WCAG 3.1.1) |
| **Bookmarks** | 99 | 606 | Has bookmarks for docs >20 pages? (WCAG 2.4.1) |
| **Empty Text** | 0 | 705 | Contains text (not just scanned images)? |
| **Protected** | 0 | 705 | Blocks screen readers? |

## Remaining Issues by Category

### Untagged PDFs (646 files)

Most critical issue — screen readers cannot navigate these documents.

| Issue | File | Pages |
|---|---|---|
| archives-04.3 | atchley.pdf | 5 |
| archives-04.3 | azari.pdf | 15 |
| archives-04.3 | caputo.pdf | 18 |
| archives-04.3 | crockett.pdf | 8 |
| archives-04.3 | livingston.pdf | 8 |
| archives-04.3 | lokensgard.pdf | 9 |
| archives-04.3 | macri.pdf | 2 |
| archives-04.3 | michaud.pdf | 3 |
| archives-04.3 | ream.pdf | 6 |
| archives-04.3 | rennie.pdf | 8 |
| archives-04.3 | saldino.pdf | 4 |
| archives-04.3 | snyder.pdf | 11 |
| archives-04.3 | thompson.pdf | 8 |
| archives-04.3 | york.pdf | 16 |
| archives-05.1 | bain-selbo.pdf | 5 |
| archives-05.1 | fasching.pdf | 5 |
| archives-05.1 | hale.pdf | 24 |
| archives-05.1 | iyer.pdf | 26 |
| archives-05.1 | juschka.pdf | 22 |
| archives-05.1 | lee.pdf | 8 |
| archives-05.1 | meeks.pdf | 9 |
| archives-05.1 | putt.pdf | 6 |
| archives-05.1 | raschke.pdf | 8 |
| archives-05.1 | siebers.pdf | 25 |
| archives-05.1 | tate.pdf | 5 |
| archives-05.2 | caputo.pdf | 21 |
| archives-05.2 | conroy.pdf | 4 |
| archives-05.2 | crockett.pdf | 5 |
| archives-05.2 | goodchild.pdf | 20 |
| archives-05.2 | iyer.pdf | 8 |
| archives-05.2 | lambert.pdf | 17 |
| archives-05.2 | lambrianou.pdf | 21 |
| archives-05.2 | raschke.pdf | 5 |
| archives-05.2 | ream.pdf | 6 |
| archives-05.2 | robbins.pdf | 4 |
| archives-05.2 | rodkey.pdf | 3 |
| archives-05.2 | taylor.pdf | 5 |
| archives-05.2 | ware.pdf | 16 |
| archives-05.2 | weislogel.pdf | 5 |
| archives-05.2 | woodard.pdf | 9 |
| archives-05.3 | biles.pdf | 15 |
| archives-05.3 | biondo.pdf | 3 |
| archives-05.3 | duke.pdf | 4 |
| archives-05.3 | flato.pdf | 5 |
| archives-05.3 | fodor.pdf | 4 |
| archives-05.3 | gilmour.pdf | 3 |
| archives-05.3 | igrek.pdf | 5 |
| archives-05.3 | keen.pdf | 4 |
| archives-05.3 | mcpherson.pdf | 9 |
| archives-05.3 | nayar.pdf | 4 |
| archives-05.3 | purcell.pdf | 4 |
| archives-05.3 | reinhart.pdf | 7 |
| archives-05.3 | robbins.pdf | 6 |
| archives-05.3 | rodkey.pdf | 3 |
| archives-05.3 | smith.pdf | 4 |
| archives-05.3 | urbanczyk.pdf | 5 |
| archives-05.3 | vahabzadeh.pdf | 6 |
| archives-05.3 | vahanian.pdf | 3 |
| archives-06.1 | blanton.pdf | 18 |
| archives-06.1 | brogan.pdf | 17 |
| archives-06.1 | caputo.pdf | 4 |
| archives-06.1 | clingerman.pdf | 6 |
| archives-06.1 | grieve-carlson.pdf | 8 |
| archives-06.1 | hoelzl.pdf | 20 |
| archives-06.1 | johnson.pdf | 21 |
| archives-06.1 | jones.pdf | 22 |
| archives-06.1 | michaud.pdf | 7 |
| archives-06.1 | taylor.pdf | 5 |
| archives-06.1 | vahanian.pdf | 6 |
| archives-06.1 | whiting.pdf | 5 |
| archives-06.1 | woodard.pdf | 11 |
| archives-06.2 | bain-selbo.pdf | 6 |
| archives-06.2 | crockett.pdf | 5 |
| archives-06.2 | fischer.pdf | 12 |
| archives-06.2 | igrek.pdf | 4 |
| archives-06.2 | kearney-taylor.pdf | 10 |
| archives-06.2 | larrey.pdf | 8 |
| archives-06.2 | raschke.pdf | 16 |
| archives-06.2 | reid.pdf | 8 |
| archives-06.2 | robbins.pdf | 6 |
| archives-06.2 | stanley.pdf | 24 |
| archives-06.2 | vahabzadeh.pdf | 13 |
| archives-06.2 | waggoner.art.pdf | 21 |
| archives-06.2 | waggoner.pdf | 12 |
| archives-06.3 | bain-selbo.pdf | 8 |
| archives-06.3 | benko.pdf | 7 |
| archives-06.3 | bowring.pdf | 5 |
| archives-06.3 | cauchi.pdf | 4 |
| archives-06.3 | grimshaw.pdf | 17 |
| archives-06.3 | harpham.pdf | 6 |
| archives-06.3 | hart.pdf | 27 |
| archives-06.3 | klink.pdf | 4 |
| archives-06.3 | kotsko.pdf | 9 |
| archives-06.3 | linck.pdf | 9 |
| archives-06.3 | lorentzen.pdf | 3 |
| archives-06.3 | nayar.pdf | 4 |
| archives-06.3 | neven.pdf | 13 |
| archives-06.3 | rodkey.pdf | 7 |
| archives-06.3 | shelton.pdf | 6 |
| archives-06.3 | smith.pdf | 6 |
| archives-06.3 | taylor.pdf | 6 |
| archives-07.1 | bell.pdf | 3 |
| archives-07.1 | buchanan.pdf | 4 |
| archives-07.1 | geroux.pdf | 16 |
| archives-07.1 | gilgen.pdf | 21 |
| archives-07.1 | holliday.pdf | 4 |
| archives-07.1 | janz.pdf | 12 |
| archives-07.1 | knowlton.pdf | 7 |
| archives-07.1 | lerner.pdf | 3 |
| archives-07.1 | lokensgard.pdf | 5 |
| archives-07.1 | magee.pdf | 9 |
| archives-07.1 | miller.pdf | 12 |
| archives-07.1 | segev.pdf | 13 |
| archives-07.1 | singh.pdf | 28 |
| archives-07.1 | taylor.pdf | 4 |
| archives-07.1 | vandeweg.pdf | 9 |
| archives-07.1 | zizek-taylor-intro.pdf | 4 |
| archives-07.2 | bain-selbo.pdf | 4 |
| archives-07.2 | dahlgren.pdf | 13 |
| archives-07.2 | heltzel.pdf | 6 |
| archives-07.2 | kolarov.pdf | 16 |
| archives-07.2 | lupton.pdf | 12 |
| archives-07.2 | miller.pdf | 15 |
| archives-07.2 | robbins.pdf | 5 |
| archives-07.2 | saldino.pdf | 7 |
| archives-07.2 | siebers.pdf | 26 |
| archives-07.2 | simmons.pdf | 6 |
| archives-07.2 | taylor.pdf | 6 |
| archives-07.2 | turner.pdf | 5 |
| archives-08.1 | alvis.pdf | 7 |
| archives-08.1 | bowman.pdf | 5 |
| archives-08.1 | buckingham.pdf | 6 |
| archives-08.1 | burton.pdf | 2 |
| archives-08.1 | costoya.pdf | 27 |
| archives-08.1 | kotsko.pdf | 8 |
| archives-08.1 | kroesbergen.pdf | 7 |
| archives-08.1 | miller.pdf | 7 |
| archives-08.1 | nayar.pdf | 3 |
| archives-08.1 | nichols.pdf | 22 |
| archives-08.1 | oventile.pdf | 8 |
| archives-08.1 | raschke.pdf | 9 |
| archives-08.1 | ritchie.pdf | 7 |
| archives-08.1 | schmidt.pdf | 14 |
| archives-08.1 | simmons.pdf | 16 |
| archives-08.1 | turrell.pdf | 7 |
| archives-08.1 | vahanian.pdf | 7 |
| archives-08.1 | waggoner.pdf | 6 |
| archives-08.1 | wright.pdf | 3 |
| archives-08.2 | abraham.pdf | 13 |
| archives-08.2 | bell.pdf | 26 |
| archives-08.2 | bivins.pdf | 23 |
| archives-08.2 | costa.pdf | 14 |
| archives-08.2 | daponte.pdf | 3 |
| archives-08.2 | davis-hardt.pdf | 26 |
| archives-08.2 | grieve-carlson.pdf | 5 |
| archives-08.2 | johnson.pdf | 6 |
| archives-08.2 | little.pdf | 18 |
| archives-08.2 | phelps.pdf | 5 |
| archives-08.2 | robbins.pdf | 7 |
| archives-08.2 | roundtable.pdf | 12 |
| archives-08.2 | smith.pdf | 4 |
| archives-08.2 | stahlberg.pdf | 6 |
| archives-08.2 | vahabzadeh.pdf | 20 |
| archives-08.3 | Ables.pdf | 8 |
| archives-08.3 | Cake.pdf | 3 |
| archives-08.3 | Eisenstadt.pdf | 6 |
| archives-08.3 | Eisenstadt2.pdf | 15 |
| archives-08.3 | Horowitz.pdf | 14 |
| archives-08.3 | Hyman.pdf | 11 |
| archives-08.3 | Jackson.pdf | 16 |
| archives-08.3 | Keller.pdf | 12 |
| archives-08.3 | Kottman.pdf | 14 |
| archives-08.3 | Kunin.pdf | 7 |
| archives-08.3 | Lupton.pdf | 12 |
| archives-08.3 | Planinc.pdf | 23 |
| archives-08.3 | Ramey.pdf | 10 |
| archives-08.3 | Simmons.pdf | 7 |
| archives-09.1 | Celermajer.pdf | 21 |
| archives-09.1 | Grieve-Carlson.pdf | 6 |
| archives-09.1 | Hyman.pdf | 15 |
| archives-09.1 | Igrek.pdf | 5 |
| archives-09.1 | Large.pdf | 18 |
| archives-09.1 | Malabou.pdf | 13 |
| archives-09.1 | Negri.pdf | 5 |
| archives-09.1 | Pound.pdf | 12 |
| archives-09.1 | Raschke.pdf | 11 |
| archives-09.1 | Rubenstein.pdf | 17 |
| archives-09.1 | Smaw.pdf | 2 |
| archives-09.2 | bielik-robson.pdf | 17 |
| archives-09.2 | boer.pdf | 17 |
| archives-09.2 | crockett.pdf | 6 |
| archives-09.2 | d'amato.pdf | 13 |
| archives-09.2 | fox.pdf | 13 |
| archives-09.2 | kotsko.pdf | 10 |
| archives-09.2 | leo.pdf | 8 |
| archives-09.2 | rodkey.pdf | 4 |
| archives-09.3 | bain-selbo.pdf | 6 |
| archives-09.3 | conroy.pdf | 4 |
| archives-09.3 | crockett.pdf | 4 |
| archives-09.3 | dickinson.pdf | 4 |
| archives-09.3 | gilmour.pdf | 2 |
| archives-09.3 | hilberg.pdf | 7 |
| archives-09.3 | hinshaw.pdf | 4 |
| archives-09.3 | kjellman.pdf | 2 |
| archives-09.3 | klink.pdf | 3 |
| archives-09.3 | lewis.pdf | 4 |
| archives-09.3 | martin.pdf | 6 |
| archives-09.3 | mccullough.pdf | 13 |
| archives-09.3 | miller.pdf | 13 |
| archives-09.3 | morehouse.pdf | 4 |
| archives-09.3 | powell.pdf | 6 |
| archives-09.3 | raschke.pdf | 7 |
| archives-09.3 | seitz.pdf | 4 |
| archives-09.3 | shoemaker.pdf | 4 |
| archives-09.3 | smith.pdf | 4 |
| archives-10.1 | Cauchi.pdf | 25 |
| archives-10.1 | Gangle.pdf | 16 |
| archives-10.1 | Miller.pdf | 6 |
| archives-10.1 | Mooney.pdf | 21 |
| archives-10.1 | Robert.pdf | 17 |
| archives-10.1 | Rodkey.pdf | 2 |
| archives-10.1 | Simmons.pdf | 21 |
| archives-10.1 | Steinmetz-Jenkins.pdf | 16 |
| archives-10.2 | bibb.pdf | 18 |
| archives-10.2 | borsuk.pdf | 18 |
| archives-10.2 | cole.pdf | 16 |
| archives-10.2 | duncan-transcription.pdf | 8 |
| archives-10.2 | mcnellis.pdf | 16 |
| archives-10.2 | mcrae.pdf | 14 |
| archives-10.2 | reid.pdf | 5 |
| archives-10.2 | simon.pdf | 21 |
| archives-10.2 | transcription.notes.pdf | 1 |
| archives-10.3 | barber&smith.pdf | 15 |
| archives-10.3 | barber.pdf | 6 |
| archives-10.3 | burkey.pdf | 7 |
| archives-10.3 | campbell.pdf | 4 |
| archives-10.3 | delpech-ramey&miller.pdf | 18 |
| archives-10.3 | grieve-carlson.pdf | 5 |
| archives-10.3 | grimshaw.pdf | 18 |
| archives-10.3 | hanson.pdf | 10 |
| archives-10.3 | jaarsma.pdf | 26 |
| archives-10.3 | metcalf.pdf | 14 |
| archives-10.3 | pcr4.pdf | 1 |
| archives-10.3 | rodkey.pdf | 3 |
| archives-10.3 | sanzaro.pdf | 8 |
| archives-10.3 | stern&gimbel.pdf | 29 |
| archives-10.3 | york.pdf | 9 |
| archives-11.1 | blanton.pdf | 26 |
| archives-11.1 | boever.pdf | 17 |
| archives-11.1 | charles.pdf | 17 |
| archives-11.1 | chrulew.pdf | 15 |
| archives-11.1 | fuggle.pdf | 13 |
| archives-11.1 | glowacki.pdf | 14 |
| archives-11.1 | mayes.pdf | 16 |
| archives-11.1 | nicolet-anderson.pdf | 15 |
| archives-11.1 | ojakangas.pdf | 19 |
| archives-11.1 | ruin.pdf | 19 |
| archives-11.2 | ardoline.pdf | 2 |
| archives-11.2 | caputo.pdf | 93 |
| archives-11.2 | crockett.pdf | 5 |
| archives-11.2 | finer.pdf | 22 |
| archives-11.2 | hagglund.pdf | 25 |
| archives-11.2 | holsclaw.pdf | 17 |
| archives-11.2 | hyman.pdf | 15 |
| archives-11.2 | mcclain.pdf | 4 |
| archives-11.2 | raschke.pdf | 8 |
| archives-11.2 | robbins.pdf | 6 |
| archives-11.2 | stockwell.pdf | 20 |
| archives-11.2 | taylor.pdf | 12 |
| archives-11.2 | wood.pdf | 28 |
| archives-11.2 | zabala.pdf | 2 |
| archives-11.3 | cfp-design.pdf | 3 |
| archives-11.3 | dalton.pdf | 8 |
| archives-11.3 | de-vries.pdf | 19 |
| archives-11.3 | kolozova.pdf | 6 |
| archives-11.3 | mccullough.pdf | 6 |
| archives-11.3 | sealey.pdf | 7 |
| archives-11.3 | simmons.pdf | 9 |
| archives-11.3 | simmonsintro.pdf | 2 |
| archives-12.1 | dicken.pdf | 18 |
| archives-12.1 | kessler.pdf | 15 |
| archives-12.1 | kornbluh.pdf | 5 |
| archives-12.1 | lupton.gordon.pdf | 4 |
| archives-12.1 | maltby.pdf | 29 |
| archives-12.1 | mciver.pdf | 5 |
| archives-12.1 | miller.pdf | 6 |
| archives-12.1 | nelson.pdf | 7 |
| archives-12.1 | rust.pdf | 6 |
| archives-12.1 | santner.pdf | 9 |
| archives-12.1 | schulman.pdf | 4 |
| archives-12.1 | vahanian.pdf | 9 |
| archives-12.1 | weitzman.pdf | 6 |
| archives-12.2 | ballan.pdf | 13 |
| archives-12.2 | blosser.pdf | 19 |
| archives-12.2 | britt.pdf | 26 |
| archives-12.2 | caputo.pdf | 22 |
| archives-12.2 | coakley.pdf | 5 |
| archives-12.2 | cochrane.pdf | 15 |
| archives-12.2 | crockett.pdf | 11 |
| archives-12.2 | dickinson-intro.pdf | 4 |
| archives-12.2 | dickinson.pdf | 21 |
| archives-12.2 | fong.pdf | 3 |
| archives-12.2 | goodchild.pdf | 17 |
| archives-12.2 | heo.pdf | 9 |
| archives-12.2 | hurlin.pdf | 12 |
| archives-12.2 | mackendrick.pdf | 16 |
| archives-12.2 | peters.pdf | 13 |
| archives-12.2 | robert.pdf | 16 |
| archives-12.2 | taylor-kosky.pdf | 20 |
| archives-12.3 | alexander.pdf | 4 |
| archives-12.3 | almond.pdf | 14 |
| archives-12.3 | alvis.pdf | 3 |
| archives-12.3 | bedford.pdf | 29 |
| archives-12.3 | mccullough.altizer.pdf | 17 |
| archives-12.3 | miller.pdf | 4 |
| archives-12.3 | nail.pdf | 19 |
| archives-12.3 | ramos.pdf | 15 |
| archives-12.3 | raschke.pdf | 19 |
| archives-12.3 | schedneck.pdf | 19 |
| archives-12.3 | smith.pdf | 36 |
| archives-12.3 | stoica.pdf | 9 |
| archives-12.3 | taylor.raschke.pdf | 12 |
| archives-13.1 | barber.pdf | 9 |
| archives-13.1 | bray.pdf | 4 |
| archives-13.1 | davis.pdf | 3 |
| archives-13.1 | dussel.pdf | 43 |
| archives-13.1 | eberle.pdf | 3 |
| archives-13.1 | lugones.pdf | 13 |
| archives-13.1 | mendez.pdf | 21 |
| archives-13.1 | miller.pdf | 4 |
| archives-13.1 | robbins.pdf | 10 |
| archives-13.1 | schmidt.pdf | 2 |
| archives-13.1 | taylor.pdf | 22 |
| archives-13.1 | tlostanova.pdf | 15 |
| archives-13.1 | woessner.pdf | 4 |
| archives-13.2 | cisney.pdf | 24 |
| archives-13.2 | clark.pdf | 10 |
| archives-13.2 | coggan.pdf | 3 |
| archives-13.2 | flavin.pdf | 14 |
| archives-13.2 | kotsko.pdf | 6 |
| archives-13.2 | lanci.pdf | 13 |
| archives-13.2 | mullen.pdf | 10 |
| archives-13.2 | nagypal.pdf | 12 |
| archives-13.2 | nuckolls.pdf | 9 |
| archives-13.2 | purakayastha.pdf | 5 |
| archives-13.2 | reyes.pdf | 12 |
| archives-13.2 | scholes.pdf | 3 |
| archives-13.2 | shaver.pdf | 6 |
| archives-13.2 | shillock.pdf | 12 |
| archives-13.2 | taylorandweiss.pdf | 6 |
| archives-13.2 | winters.pdf | 3 |
| archives-14.1 | alvis.pdf | 13 |
| archives-14.1 | fagenblat.pdf | 17 |
| archives-14.1 | featherstone.pdf | 14 |
| archives-14.1 | green.pdf | 22 |
| archives-14.1 | lauri.pdf | 17 |
| archives-14.1 | raschke.pdf | 7 |
| archives-14.1 | renger.pdf | 14 |
| archives-14.1 | schyllert.pdf | 3 |
| archives-14.1 | settle.pdf | 20 |
| archives-14.1 | snediker.pdf | 20 |
| archives-14.1 | trier.pdf | 19 |
| archives-14.1 | winters.pdf | 30 |
| archives-14.1 | yonker.pdf | 6 |
| archives-14.2 | aikin.pdf | 7 |
| archives-14.2 | feddon.pdf | 12 |
| archives-14.2 | greco.pdf | 5 |
| archives-14.2 | gschwandtner.pdf | 20 |
| archives-14.2 | holdier.pdf | 20 |
| archives-14.2 | kavka.pdf | 16 |
| archives-14.2 | kelly.pdf | 16 |
| archives-14.2 | knepper.pdf | 10 |
| archives-14.2 | loewen.pdf | 12 |
| archives-14.2 | moser.pdf | 11 |
| archives-14.2 | mulder.pdf | 9 |
| archives-14.2 | schellenberg.pdf | 15 |
| archives-14.2 | schilbrack.pdf | 6 |
| archives-14.2 | shuster.pdf | 26 |
| archives-14.2 | simmons-intro.pdf | 7 |
| archives-14.2 | trakikis.pdf | 12 |
| archives-14.2 | weidler.pdf | 27 |
| archives-14.2 | wolterstorff-preface.pdf | 4 |
| archives-15.1 | alvis.pdf | 21 |
| archives-15.1 | cohen.pdf | 7 |
| archives-15.1 | hagedorn.pdf | 14 |
| archives-15.1 | intro.pdf | 2 |
| archives-15.1 | raschke.pdf | 16 |
| archives-15.1 | schuback.pdf | 12 |
| archives-15.1 | staudigl.pdf | 15 |
| archives-15.1 | steinbock.pdf | 18 |
| archives-15.1 | welten.pdf | 13 |
| archives-15.2 | aldinger.pdf | 13 |
| archives-15.2 | betcher.pdf | 18 |
| archives-15.2 | fox.pdf | 16 |
| archives-15.2 | intro.pdf | 3 |
| archives-15.2 | reid.pdf | 17 |
| archives-15.2 | sanchez.pdf | 12 |
| archives-15.2 | siebers.pdf | 23 |
| archives-15.2 | valente.pdf | 14 |
| archives-15.2 | valente2.pdf | 6 |
| archives-16.1 | Carson.pdf | 2 |
| archives-16.1 | Ferguson.pdf | 12 |
| archives-16.1 | InterviewGaia.pdf | 5 |
| archives-16.1 | InterviewGiroux.pdf | 5 |
| archives-16.1 | InterviewSousanis.pdf | 10 |
| archives-16.1 | InterviewUlmer.pdf | 16 |
| archives-16.1 | IntroFigueiredo.pdf | 4 |
| archives-16.1 | Li.pdf | 17 |
| archives-16.1 | Obrien.pdf | 4 |
| archives-16.1 | Raschke.pdf | 18 |
| archives-16.1 | reviewbutler.pdf | 14 |
| archives-16.2 | Armstrong.pdf | 16 |
| archives-16.2 | Bray.pdf | 21 |
| archives-16.2 | Dubilet.pdf | 16 |
| archives-16.2 | Intro-Marovich.pdf | 17 |
| archives-16.2 | Marovich.pdf | 17 |
| archives-16.2 | Meyer.pdf | 16 |
| archives-16.2 | Moody.pdf | 28 |
| archives-16.2 | Rose.pdf | 20 |
| archives-16.3 | Beddard.pdf | 14 |
| archives-16.3 | Congdon.pdf | 36 |
| archives-16.3 | Davis.pdf | 23 |
| archives-16.3 | Introduction.pdf | 11 |
| archives-16.3 | Karlsen.pdf | 34 |
| archives-16.3 | Leung.pdf | 20 |
| archives-16.3 | Osserman.pdf | 21 |
| archives-16.3 | Phelps.pdf | 17 |
| archives-16.3 | Weaver.pdf | 15 |
| archives-17.1 | Beiner.pdf | 16 |
| archives-17.1 | Bielik.pdf | 20 |
| archives-17.1 | Caputo.pdf | 20 |
| archives-17.1 | Dean.pdf | 13 |
| archives-17.1 | Fitzgerald.pdf | 28 |
| archives-17.1 | Keller.pdf | 11 |
| archives-17.1 | Muraca.pdf | 17 |
| archives-17.1 | Ogunnaike.pdf | 31 |
| archives-17.1 | Raschke.pdf | 17 |
| archives-17.1 | Richard.pdf | 32 |
| archives-17.1 | Taylor.pdf | 32 |
| archives-17.2 | Alvis.pdf | 19 |
| archives-17.2 | Bornemark.pdf | 14 |
| archives-17.2 | DeWarren.pdf | 17 |
| archives-17.2 | Dodd.pdf | 25 |
| archives-17.2 | Evink.pdf | 13 |
| archives-17.2 | Gschwandtner.pdf | 17 |
| archives-17.2 | Hagedorn-and-Staudigl.pdf | 16 |
| archives-17.2 | Hart.pdf | 28 |
| archives-17.2 | Klun.pdf | 15 |
| archives-17.2 | Marion.pdf | 10 |
| archives-17.2 | Mensch.pdf | 9 |
| archives-17.2 | OMurchadha.pdf | 15 |
| archives-17.2 | Prole.pdf | 15 |
| archives-17.2 | Rivera.pdf | 21 |
| archives-17.2 | leclercq.pdf | 9 |
| archives-17.3 | Backman.pdf | 6 |
| archives-17.3 | Beddard.pdf | 7 |
| archives-17.3 | Datar.pdf | 8 |
| archives-17.3 | Davis.pdf | 8 |
| archives-17.3 | Green.pdf | 14 |
| archives-17.3 | Kavoulakos.pdf | 5 |
| archives-17.3 | Lawrence.pdf | 8 |
| archives-17.3 | Rhodes.pdf | 31 |
| archives-17.3 | Schmidt.pdf | 8 |
| archives-17.3 | Soni.pdf | 22 |
| archives-17.3 | Tutt.pdf | 15 |
| archives-17.3 | Yonker.pdf | 4 |
| archives-18.1 | Appel.pdf | 5 |
| archives-18.1 | Bios.pdf | 2 |
| archives-18.1 | Burke2.pdf | 21 |
| archives-18.1 | Cook1.pdf | 25 |
| archives-18.1 | Delay.pdf | 2 |
| archives-18.1 | Green.pdf | 7 |
| archives-18.1 | Komkov2.pdf | 11 |
| archives-18.1 | Koser.pdf | 5 |
| archives-18.1 | Loland1.pdf | 14 |
| archives-18.1 | McAndrew.pdf | 6 |
| archives-18.1 | Pederson.pdf | 11 |
| archives-18.1 | Ramos1.pdf | 4 |
| archives-18.1 | Richard.pdf | 9 |
| archives-18.1 | Sharma2.pdf | 17 |
| archives-18.1 | Spickard2.pdf | 18 |
| archives-18.2 | Bios.pdf | 4 |
| archives-18.2 | DeRoo.pdf | 20 |
| archives-18.2 | Fishley.pdf | 9 |
| archives-18.2 | Giardino.pdf | 12 |
| archives-18.2 | Graham.pdf | 18 |
| archives-18.2 | Green.pdf | 18 |
| archives-18.2 | Guerriero.pdf | 6 |
| archives-18.2 | Harrison.pdf | 9 |
| archives-18.2 | Hovorun.pdf | 10 |
| archives-18.2 | Konigsburg.pdf | 7 |
| archives-18.2 | Lewis.pdf | 20 |
| archives-18.2 | McAvan.pdf | 10 |
| archives-18.2 | Oliver.pdf | 19 |
| archives-18.2 | Pessin.pdf | 10 |
| archives-18.2 | Prewitt-Davis.pdf | 9 |
| archives-18.2 | Samuel.pdf | 8 |
| archives-18.2 | Stanton.pdf | 12 |
| archives-18.2 | Trozzo.pdf | 14 |
| archives-18.2 | Vaino.pdf | 15 |
| archives-18.3 | Burley.pdf | 25 |
| archives-18.3 | Cisney.pdf | 24 |
| archives-18.3 | Deibl.pdf | 17 |
| archives-18.3 | Goggin.pdf | 18 |
| archives-18.3 | Haynes.pdf | 15 |
| archives-18.3 | Jones.pdf | 14 |
| archives-18.3 | McCracken.pdf | 13 |
| archives-18.3 | Murphy.pdf | 18 |
| archives-18.3 | Onishi.pdf | 12 |
| archives-18.3 | Roberts.pdf | 10 |
| archives-18.3 | Rubenstein.pdf | 12 |
| archives-18.3 | Ruetenik.pdf | 12 |
| archives-18.3 | Tarleton.pdf | 13 |
| archives-18.3 | robertsandhayden.pdf | 15 |
| archives-19.1 | Casey.pdf | 6 |
| archives-19.1 | Cobb.pdf | 6 |
| archives-19.1 | Dise.pdf | 16 |
| archives-19.1 | Feld.pdf | 18 |
| archives-19.1 | Franke.pdf | 15 |
| archives-19.1 | Hart.pdf | 3 |
| archives-19.1 | Hass.pdf | 17 |
| archives-19.1 | Jennings.pdf | 15 |
| archives-19.1 | McCullough.pdf | 22 |
| archives-19.1 | Quasha.pdf | 13 |
| archives-19.1 | Raschke.pdf | 16 |
| archives-19.1 | Redell.pdf | 12 |
| archives-19.1 | Rubenstein.pdf | 8 |
| archives-19.1 | Schroeder.pdf | 18 |
| archives-19.1 | Taylor.pdf | 7 |
| archives-19.1 | Wolfson.pdf | 33 |
| archives-19.1 | bios.pdf | 4 |
| archives-19.2 | Green.pdf | 18 |
| archives-19.2 | Hackett.pdf | 19 |
| archives-19.2 | Hurley.pdf | 14 |
| archives-19.2 | Hyman.pdf | 19 |
| archives-19.2 | Maltby.pdf | 31 |
| archives-19.2 | Marion.pdf | 10 |
| archives-19.2 | McAvan.pdf | 11 |
| archives-19.2 | Molla.pdf | 11 |
| archives-19.2 | Murphy.pdf | 7 |
| archives-19.2 | Rosen.pdf | 15 |
| archives-19.2 | Tinker.pdf | 11 |
| archives-19.2 | bios.pdf | 4 |
| archives-19.3 | 1-Britt.pdf | 2 |
| archives-19.3 | 2-Almog.pdf | 11 |
| archives-19.3 | 3-Britt.pdf | 9 |
| archives-19.3 | 4-Green.pdf | 15 |
| archives-19.3 | 5-Leibovic.pdf | 8 |
| archives-19.3 | 6-Rotlevy.pdf | 17 |
| archives-19.3 | 7-Salzani.pdf | 10 |
| archives-19.3 | 8-Weidner.pdf | 13 |
| archives-19.3 | bios.pdf | 3 |
| archives-20.1 | Ball.pdf | 14 |
| archives-20.1 | Bedford.pdf | 5 |
| archives-20.1 | Conroy.pdf | 22 |
| archives-20.1 | Lacey.pdf | 9 |
| archives-20.1 | Maeshiro.pdf | 43 |
| archives-20.1 | McMaken.pdf | 14 |
| archives-20.1 | Reiser.pdf | 37 |
| archives-20.1 | Urquidez.pdf | 23 |
| archives-20.1 | Willis.pdf | 14 |
| archives-20.1 | bios.pdf | 2 |
| archives-20.2 | Praise.pdf | 121 |
| archives-20.2 | bios.pdf | 2 |
| archives-20.3 | Boulting.pdf | 16 |
| archives-20.3 | Cuda.pdf | 24 |
| archives-20.3 | Decoloniality.pdf | 20 |
| archives-20.3 | Felese.pdf | 13 |
| archives-20.3 | Holdier.pdf | 9 |
| archives-20.3 | Kline.pdf | 18 |
| archives-20.3 | Klug.pdf | 21 |
| archives-20.3 | bios.pdf | 2 |
| archives-21.1 | Bakker.pdf | 22 |
| archives-21.1 | Boulting.pdf | 21 |
| archives-21.1 | Burkette.pdf | 22 |
| archives-21.1 | Marinho.pdf | 33 |
| archives-21.1 | Raubach.pdf | 19 |
| archives-21.1 | Sirota.pdf | 18 |
| archives-21.1 | Skof.pdf | 22 |
| archives-21.1 | bios.pdf | 2 |
| archives-21.2 | Afridi.pdf | 12 |
| archives-21.2 | Arnold.pdf | 4 |
| archives-21.2 | Macdonald.pdf | 28 |
| archives-21.2 | Molla.pdf | 18 |
| archives-21.2 | Taylor.pdf | 10 |
| archives-21.2 | Walker.pdf | 11 |
| archives-21.2 | Wood.pdf | 31 |
| archives-21.2 | bios.pdf | 3 |
| archives-21.3 | Bradley0.pdf | 30 |
| archives-21.3 | Bradley1.pdf | 2 |
| archives-21.3 | Bradley2.pdf | 3 |
| archives-21.3 | Bradley3.pdf | 4 |
| archives-21.3 | Bradley4.pdf | 4 |
| archives-21.3 | Bradley5.pdf | 10 |
| archives-21.3 | Bradley6.pdf | 4 |
| archives-21.3 | Bradley7.pdf | 8 |
| archives-21.3 | Bradley8.pdf | 3 |
| archives-21.3 | Johnston.pdf | 34 |
| archives-21.3 | Meganck.pdf | 23 |
| archives-21.3 | Raschke.pdf | 19 |
| archives-21.3 | Simon.pdf | 35 |
| archives-21.3 | bios.pdf | 2 |
| archives-22.1 | Auer.pdf | 13 |
| archives-22.1 | Hujing.pdf | 15 |
| archives-22.1 | Magnasco.pdf | 15 |
| archives-22.1 | Patry.pdf | 22 |
| archives-22.1 | Quell.pdf | 23 |
| archives-22.1 | Westin.pdf | 4 |
| archives-22.1 | Wurts.pdf | 30 |
| archives-22.1 | grane.pdf | 17 |
| archives-22.2 | Byng.pdf | 17 |
| archives-22.2 | Dubus.pdf | 14 |
| archives-22.2 | Hall.pdf | 23 |
| archives-22.2 | Howes.pdf | 24 |
| archives-22.2 | Keller.pdf | 23 |
| archives-22.2 | Raschke.pdf | 16 |
| archives-22.2 | Singh.pdf | 27 |
| archives-22.2 | bios.pdf | 2 |
| archives-23.1 | Durante.pdf | 9 |
| archives-23.1 | Grane.pdf | 8 |
| archives-23.1 | Hujing.pdf | 10 |
| archives-23.1 | Johnson.pdf | 12 |
| archives-23.1 | Kaur.pdf | 26 |
| archives-23.1 | Massaro.pdf | 10 |
| archives-23.1 | Mather.pdf | 13 |
| archives-23.1 | McKanan.pdf | 14 |
| archives-23.1 | Monson.pdf | 9 |
| archives-23.1 | Pope.pdf | 16 |
| archives-23.1 | Prewitt-Davis.pdf | 9 |
| archives-23.1 | bios.pdf | 2 |
| archives-23.2 | Arnold.pdf | 8 |
| archives-23.2 | Marks.pdf | 25 |
| archives-23.2 | Porter.pdf | 11 |
| archives-23.2 | Raschke.pdf | 21 |
| archives-23.2 | Sendag.pdf | 21 |
| archives-23.2 | bios.pdf | 2 |
| archives-25.1 | brett-and-hill.pdf | 13 |
| archives-25.1 | conclusion.pdf | 3 |
| archives-25.1 | d_errico.pdf | 13 |
| archives-25.1 | goudy.pdf | 34 |
| archives-25.1 | heath.pdf | 10 |
| archives-25.1 | miller.pdf | 7 |
| archives-25.1 | newcomb.pdf | 16 |
| archives-25.1 | postscript.pdf | 21 |
| archives-25.1 | rodgers-falk.pdf | 14 |
| archives-25.1 | schwartzberg.pdf | 36 |

### Missing/Broken Title (646 files)

Document title missing or DisplayDocTitle flag not set.

### Missing Bookmarks for Long Documents (99 files)

Documents with >20 pages that lack bookmarks:

| Issue | File | Pages |
|---|---|---|
| archives-05.1 | hale.pdf | 24 |
| archives-05.1 | iyer.pdf | 26 |
| archives-05.1 | juschka.pdf | 22 |
| archives-05.1 | siebers.pdf | 25 |
| archives-05.2 | caputo.pdf | 21 |
| archives-05.2 | lambrianou.pdf | 21 |
| archives-06.1 | johnson.pdf | 21 |
| archives-06.1 | jones.pdf | 22 |
| archives-06.2 | stanley.pdf | 24 |
| archives-06.2 | waggoner.art.pdf | 21 |
| archives-06.3 | hart.pdf | 27 |
| archives-07.1 | gilgen.pdf | 21 |
| archives-07.1 | singh.pdf | 28 |
| archives-07.2 | siebers.pdf | 26 |
| archives-08.1 | nichols.pdf | 22 |
| archives-08.2 | bell.pdf | 26 |
| archives-08.2 | bivins.pdf | 23 |
| archives-08.2 | davis-hardt.pdf | 26 |
| archives-08.3 | Planinc.pdf | 23 |
| archives-09.1 | Celermajer.pdf | 21 |
| archives-10.1 | Cauchi.pdf | 25 |
| archives-10.1 | Mooney.pdf | 21 |
| archives-10.1 | Simmons.pdf | 21 |
| archives-10.2 | simon.pdf | 21 |
| archives-10.3 | jaarsma.pdf | 26 |
| archives-10.3 | stern&gimbel.pdf | 29 |
| archives-11.1 | blanton.pdf | 26 |
| archives-11.2 | caputo.pdf | 93 |
| archives-11.2 | finer.pdf | 22 |
| archives-11.2 | hagglund.pdf | 25 |
| archives-11.2 | wood.pdf | 28 |
| archives-12.1 | maltby.pdf | 29 |
| archives-12.2 | caputo.pdf | 22 |
| archives-12.2 | dickinson.pdf | 21 |
| archives-12.3 | bedford.pdf | 29 |
| archives-12.3 | smith.pdf | 36 |
| archives-13.1 | dussel.pdf | 43 |
| archives-13.1 | mendez.pdf | 21 |
| archives-13.1 | taylor.pdf | 22 |
| archives-13.2 | cisney.pdf | 24 |
| archives-14.1 | green.pdf | 22 |
| archives-14.1 | winters.pdf | 30 |
| archives-14.2 | shuster.pdf | 26 |
| archives-14.2 | weidler.pdf | 27 |
| archives-15.1 | alvis.pdf | 21 |
| archives-15.2 | siebers.pdf | 23 |
| archives-16.2 | Bray.pdf | 21 |
| archives-16.2 | Moody.pdf | 28 |
| archives-16.3 | Congdon.pdf | 36 |
| archives-16.3 | Davis.pdf | 23 |
| archives-16.3 | Karlsen.pdf | 34 |
| archives-16.3 | Osserman.pdf | 21 |
| archives-17.1 | Fitzgerald.pdf | 28 |
| archives-17.1 | Ogunnaike.pdf | 31 |
| archives-17.1 | Richard.pdf | 32 |
| archives-17.1 | Taylor.pdf | 32 |
| archives-17.2 | Dodd.pdf | 25 |
| archives-17.2 | Hart.pdf | 28 |
| archives-17.2 | Rivera.pdf | 21 |
| archives-17.3 | Rhodes.pdf | 31 |
| archives-17.3 | Soni.pdf | 22 |
| archives-18.1 | Burke2.pdf | 21 |
| archives-18.1 | Cook1.pdf | 25 |
| archives-18.3 | Burley.pdf | 25 |
| archives-18.3 | Cisney.pdf | 24 |
| archives-19.1 | McCullough.pdf | 22 |
| archives-19.1 | Wolfson.pdf | 33 |
| archives-19.2 | Maltby.pdf | 31 |
| archives-20.1 | Conroy.pdf | 22 |
| archives-20.1 | Maeshiro.pdf | 43 |
| archives-20.1 | Reiser.pdf | 37 |
| archives-20.1 | Urquidez.pdf | 23 |
| archives-20.2 | Praise.pdf | 121 |
| archives-20.3 | Cuda.pdf | 24 |
| archives-20.3 | Klug.pdf | 21 |
| archives-21.1 | Bakker.pdf | 22 |
| archives-21.1 | Boulting.pdf | 21 |
| archives-21.1 | Burkette.pdf | 22 |
| archives-21.1 | Marinho.pdf | 33 |
| archives-21.1 | Skof.pdf | 22 |
| archives-21.2 | Macdonald.pdf | 28 |
| archives-21.2 | Wood.pdf | 31 |
| archives-21.3 | Bradley0.pdf | 30 |
| archives-21.3 | Johnston.pdf | 34 |
| archives-21.3 | Meganck.pdf | 23 |
| archives-21.3 | Simon.pdf | 35 |
| archives-22.1 | Patry.pdf | 22 |
| archives-22.1 | Quell.pdf | 23 |
| archives-22.1 | Wurts.pdf | 30 |
| archives-22.2 | Hall.pdf | 23 |
| archives-22.2 | Howes.pdf | 24 |
| archives-22.2 | Keller.pdf | 23 |
| archives-22.2 | Singh.pdf | 27 |
| archives-23.1 | Kaur.pdf | 26 |
| archives-23.2 | Raschke.pdf | 21 |
| archives-23.2 | Sendag.pdf | 21 |
| archives-25.1 | goudy.pdf | 34 |
| archives-25.1 | postscript.pdf | 21 |
| archives-25.1 | schwartzberg.pdf | 36 |

## Results by Issue

| Issue | PDFs | Accessible | Inaccessible | Untagged | No Title | No Lang |
|---|---|---|---|---|---|---|
| archives-04.3 | 14 | 0 | 0 | 14 | 14 | 0 |
| archives-05.1 | 11 | 0 | 0 | 11 | 11 | 0 |
| archives-05.2 | 15 | 0 | 0 | 15 | 15 | 0 |
| archives-05.3 | 18 | 0 | 0 | 18 | 18 | 0 |
| archives-06.1 | 13 | 0 | 0 | 13 | 13 | 0 |
| archives-06.2 | 13 | 0 | 0 | 13 | 13 | 0 |
| archives-06.3 | 17 | 0 | 0 | 17 | 17 | 0 |
| archives-07.1 | 16 | 0 | 0 | 16 | 16 | 0 |
| archives-07.2 | 12 | 0 | 0 | 12 | 12 | 0 |
| archives-08.1 | 19 | 0 | 0 | 19 | 19 | 0 |
| archives-08.2 | 15 | 0 | 0 | 15 | 15 | 0 |
| archives-08.3 | 14 | 0 | 0 | 14 | 14 | 0 |
| archives-09.1 | 11 | 0 | 0 | 11 | 11 | 0 |
| archives-09.2 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-09.3 | 20 | 0 | 0 | 19 | 20 | 0 |
| archives-10.1 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-10.2 | 9 | 0 | 0 | 9 | 9 | 0 |
| archives-10.3 | 15 | 0 | 0 | 15 | 15 | 0 |
| archives-11.1 | 10 | 0 | 0 | 10 | 10 | 0 |
| archives-11.2 | 14 | 0 | 0 | 14 | 14 | 0 |
| archives-11.3 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-12.1 | 13 | 0 | 0 | 13 | 13 | 0 |
| archives-12.2 | 17 | 0 | 0 | 17 | 17 | 0 |
| archives-12.3 | 13 | 0 | 0 | 13 | 13 | 0 |
| archives-13.1 | 14 | 1 | 0 | 13 | 13 | 0 |
| archives-13.2 | 16 | 0 | 0 | 16 | 16 | 0 |
| archives-14.1 | 13 | 0 | 0 | 13 | 13 | 0 |
| archives-14.2 | 18 | 0 | 0 | 18 | 18 | 0 |
| archives-15.1 | 9 | 0 | 0 | 9 | 9 | 0 |
| archives-15.2 | 9 | 0 | 0 | 9 | 9 | 0 |
| archives-16.1 | 11 | 0 | 0 | 11 | 11 | 0 |
| archives-16.2 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-16.3 | 9 | 0 | 0 | 9 | 9 | 0 |
| archives-17.1 | 11 | 0 | 0 | 11 | 11 | 0 |
| archives-17.2 | 15 | 0 | 0 | 15 | 15 | 0 |
| archives-17.3 | 12 | 0 | 0 | 12 | 12 | 0 |
| archives-18.1 | 15 | 0 | 0 | 15 | 15 | 0 |
| archives-18.2 | 19 | 0 | 0 | 19 | 19 | 0 |
| archives-18.3 | 14 | 0 | 0 | 14 | 14 | 0 |
| archives-19.1 | 17 | 0 | 0 | 17 | 17 | 0 |
| archives-19.2 | 12 | 0 | 0 | 12 | 12 | 0 |
| archives-19.3 | 9 | 0 | 0 | 9 | 9 | 0 |
| archives-20.1 | 10 | 0 | 0 | 10 | 10 | 0 |
| archives-20.2 | 2 | 0 | 0 | 2 | 2 | 0 |
| archives-20.3 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-21.1 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-21.2 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-21.3 | 14 | 0 | 0 | 14 | 14 | 0 |
| archives-22.1 | 8 | 0 | 0 | 8 | 7 | 0 |
| archives-22.2 | 8 | 0 | 0 | 8 | 8 | 0 |
| archives-23.1 | 12 | 0 | 0 | 12 | 12 | 0 |
| archives-23.2 | 6 | 0 | 0 | 6 | 6 | 0 |
| archives-24.1 | 11 | 11 | 0 | 0 | 0 | 0 |
| archives-24.2 | 20 | 20 | 0 | 0 | 0 | 0 |
| archives-25.1 | 10 | 0 | 0 | 10 | 10 | 0 |
| docs | 24 | 24 | 0 | 0 | 0 | 0 |
| docs-ptt | 2 | 2 | 0 | 0 | 0 | 0 |

## PDF Creator Software (top 20)

| Creator | Count |
|---|---|
| Microsoft Word | 16 |
| Word | 8 |
| Acrobat PDFMaker 9.0 for Word | 1 |
| PDFpen | 1 |
| PScript5.dll Version 5.2.2 | 1 |

---

*Generated by simplA11yPDFCrawler + set_pdf_lang.py*
