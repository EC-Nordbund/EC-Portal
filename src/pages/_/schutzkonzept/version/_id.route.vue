<template lang="pug">
ec-wrapper(
  :title='version ? `Formular Version ${version.versionNr}` : "Formular"',
  :subTitle='untertitel',
  hasXBtn,
  hasHeader
)
  template(#header)
    .d-flex.align-center.flex-wrap.ga-2.px-4.pb-2(v-if='version')
      v-chip(v-if='readonly', color='green', variant='flat', size='small', prepend-icon='lock') Veröffentlicht – unveränderlich
      v-chip(v-else, color='orange', variant='flat', size='small') Entwurf
      v-chip(v-if='geaendert', color='red', variant='tonal', size='small') Ungespeicherte Änderungen
      v-spacer
      template(v-if='!readonly')
        v-btn(
          variant='tonal',
          prepend-icon='save',
          :loading='speichert',
          :disabled='!geaendert || veroeffentlicht',
          @click='speichern()'
        ) Speichern
        //- Während eines PUT gesperrt: sonst zweiter PUT mit alter Revision
        v-btn(
          variant='flat',
          v-accent-bg,
          v-white,
          prepend-icon='publish',
          :loading='veroeffentlicht',
          :disabled='speichert && !veroeffentlicht',
          @click='veroeffentlichen'
        ) Veröffentlichen
      v-btn(
        v-else-if='!draftVorhanden',
        variant='tonal',
        prepend-icon='add',
        @click='neueVersion'
      ) Neue Version anlegen
    v-tabs(v-model='tab', density='compact', color='primary')
      v-tab(value='aufbau') Aufbau
      v-tab(value='vorlagen') Vorlagen ({{ vorlagen.length }})
      v-tab(value='vorschau') Vorschau
      v-tab(value='pruefung')
        | Prüfung
        v-chip.ml-2(
          v-if='pruefung.fehler.length',
          size='x-small',
          color='red',
          variant='flat'
        ) {{ pruefung.fehler.length }}
        v-chip.ml-2(
          v-if='pruefung.warnungen.length',
          size='x-small',
          color='orange',
          variant='flat'
        ) {{ pruefung.warnungen.length }}

  v-progress-linear(v-if='laedt', indeterminate, color='primary')

  template(v-if='version && def')
    //- ------------------------------------------------------------ Aufbau --
    v-row(v-if='tab === "aufbau"')
      v-col(cols='12', md='5')
        v-text-field.mb-2(
          label='Notiz zu dieser Version',
          v-model='notiz',
          :readonly='readonly',
          :rules='[hoechstens(NOTIZ_LAENGE)]',
          density='compact',
          hide-details='auto'
        )
        //- Einstellung der ganzen Definition -- sie hängt an keinem Element
        //- im Baum und steht deshalb hier über ihm.
        v-checkbox.mb-2(
          label='Abschnitte einzeln bestätigen lassen',
          v-model='def.einstellungen.abschnitteBestaetigen',
          :readonly='readonly',
          density='compact',
          hide-details='auto',
          hint='Der EC-Kreis muss jeden Abschnitt als geprüft markieren, bevor er seinen Stand veröffentlichen kann. Ändert sich danach ein Wert des Abschnitts, ist die Bestätigung wieder weg.',
          persistent-hint
        )
        .baum
          template(v-for='(b, bi) in def.bereiche', :key='b.id')
            .zeile.stufe-0(:class='{ aktiv: auswahlId === b.id }', @click='waehle(b.id)')
              v-icon.mr-2(size='small', color='primary') folder
              span.flex-grow-1.text-truncate.font-weight-medium {{ bi + 1 }}. {{ b.titel || '(ohne Titel)' }}
              template(v-if='!readonly')
                v-btn(icon, size='x-small', variant='text', :disabled='bi === 0', @click.stop='verschiebe(def.bereiche, bi, -1)')
                  v-icon arrow_upward
                v-btn(icon, size='x-small', variant='text', :disabled='bi === def.bereiche.length - 1', @click.stop='verschiebe(def.bereiche, bi, 1)')
                  v-icon arrow_downward
                v-btn(icon, size='x-small', variant='text', @click.stop='loesche(def.bereiche, bi, `Bereich „${b.titel}“ mit allen Abschnitten`)')
                  v-icon delete
            template(v-for='(a, ai) in b.abschnitte', :key='a.id')
              .zeile.stufe-1(:class='{ aktiv: auswahlId === a.id }', @click='waehle(a.id)')
                v-icon.mr-2(size='small') view_agenda
                span.flex-grow-1.text-truncate {{ a.titel || '(ohne Titel)' }}
                template(v-if='!readonly')
                  v-btn(icon, size='x-small', variant='text', :disabled='ai === 0', @click.stop='verschiebe(b.abschnitte, ai, -1)')
                    v-icon arrow_upward
                  v-btn(icon, size='x-small', variant='text', :disabled='ai === b.abschnitte.length - 1', @click.stop='verschiebe(b.abschnitte, ai, 1)')
                    v-icon arrow_downward
                  v-btn(icon, size='x-small', variant='text', @click.stop='loesche(b.abschnitte, ai, `Abschnitt „${a.titel}“ mit allen Feldern`)')
                    v-icon delete
              template(v-for='(f, fi) in a.felder', :key='f.id')
                .zeile.stufe-2(:class='{ aktiv: auswahlId === f.id }', @click='waehle(f.id)')
                  v-icon.mr-2(size='small') {{ typIcon(f.typ) }}
                  span.flex-grow-1.text-truncate
                    | {{ f.label || '(ohne Beschriftung)' }}
                    span.text-error(v-if='f.pflicht && f.typ !== "info"') &nbsp;*
                  code.text-caption.mr-1(v-if='f.key && f.typ !== "info"') {{ f.key }}
                  template(v-if='!readonly')
                    v-btn(icon, size='x-small', variant='text', :disabled='fi === 0', @click.stop='verschiebe(a.felder, fi, -1)')
                      v-icon arrow_upward
                    v-btn(icon, size='x-small', variant='text', :disabled='fi === a.felder.length - 1', @click.stop='verschiebe(a.felder, fi, 1)')
                      v-icon arrow_downward
                    v-btn(icon, size='x-small', variant='text', @click.stop='loesche(a.felder, fi, `Feld „${f.label}“`)')
                      v-icon delete
                template(v-if='f.typ === "gruppe"')
                  .zeile.stufe-3(
                    v-for='(s, si) in f.felder',
                    :key='s.id',
                    :class='{ aktiv: auswahlId === s.id }',
                    @click='waehle(s.id)'
                  )
                    v-icon.mr-2(size='small') view_column
                    span.flex-grow-1.text-truncate
                      | {{ s.label || '(ohne Beschriftung)' }}
                      span.text-error(v-if='s.pflicht') &nbsp;*
                    code.text-caption.mr-1(v-if='s.key') {{ s.key }}
                    template(v-if='!readonly')
                      v-btn(icon, size='x-small', variant='text', :disabled='si === 0', @click.stop='verschiebe(f.felder, si, -1)')
                        v-icon arrow_upward
                      v-btn(icon, size='x-small', variant='text', :disabled='si === f.felder.length - 1', @click.stop='verschiebe(f.felder, si, 1)')
                        v-icon arrow_downward
                      v-btn(icon, size='x-small', variant='text', @click.stop='loesche(f.felder, si, `Spalte „${s.label}“`)')
                        v-icon delete
                  .zeile.stufe-3.neu(v-if='!readonly && f.felder.length < GRENZEN.maxSpalten', @click='neueSpalte(f)')
                    v-icon.mr-2(size='small') add
                    span Spalte
              .zeile.stufe-2.neu(v-if='!readonly && a.felder.length < GRENZEN.maxFelder', @click='neuesFeld(a)')
                v-icon.mr-2(size='small') add
                span Feld
            .zeile.stufe-1.neu(v-if='!readonly && b.abschnitte.length < GRENZEN.maxAbschnitte', @click='neuerAbschnitt(b)')
              v-icon.mr-2(size='small') add
              span Abschnitt
          .zeile.stufe-0.neu(v-if='!readonly && def.bereiche.length < GRENZEN.maxBereiche', @click='neuerBereich')
            v-icon.mr-2(size='small') add
            span Bereich
          .text-medium-emphasis.pa-2(v-if='readonly && !def.bereiche.length') Diese Version hat keine Bereiche.

      v-col(cols='12', md='7')
        //- sticky: der Baum ist lang, der Editor soll beim Scrollen sichtbar bleiben
        v-card.editor-sticky(variant='outlined', v-if='auswahl')
          v-card-text
            //- Bereich / Abschnitt
            template(v-if='auswahl.art === "bereich" || auswahl.art === "abschnitt"')
              .text-overline {{ auswahl.art === 'bereich' ? 'Bereich (ein Schritt im Stepper)' : 'Abschnitt (eine Card)' }}
              v-text-field(
                label='Titel',
                v-model='auswahl.obj.titel',
                :readonly='readonly',
                :rules='[hoechstens(GRENZEN.labelLaenge)]'
              )
              v-textarea(
                label='Beschreibung',
                v-model='auswahl.obj.beschreibung',
                :readonly='readonly',
                :rules='[hoechstens(GRENZEN.hilfeLaenge)]',
                :counter='GRENZEN.hilfeLaenge',
                rows='3',
                auto-grow,
                hint='Wird über dem Inhalt angezeigt (Zeilenumbrüche bleiben erhalten).',
                persistent-hint
              )
              template(v-if='auswahl.art === "abschnitt" && !readonly')
                v-select.mt-4(
                  label='Verschieben nach Bereich …',
                  :items='verschiebeZiele',
                  :model-value='null',
                  density='compact',
                  hint='Behält die IDs – die Antworten der EC-Kreise werden übernommen.',
                  persistent-hint,
                  @update:model-value='verschiebeNach'
                )

            //- Feld / Spalte
            template(v-else)
              .text-overline
                | {{ auswahl.art === 'spalte' ? `Spalte der Tabelle „${auswahl.gruppe?.label}“` : 'Feld' }}
              v-text-field(
                :label='auswahl.obj.typ === "info" ? "Überschrift" : "Beschriftung / Frage"',
                v-model='auswahl.obj.label',
                :readonly='readonly',
                :rules='[hoechstens(GRENZEN.labelLaenge)]',
                @update:model-value='labelGeaendert(auswahl.obj)'
              )
              //- Kein v-model: typAendern() fragt vor verlustbehafteten Wechseln
              //- nach und lässt bei Abbruch den alten Typ stehen.
              v-select(
                label='Typ',
                :items='auswahl.art === "spalte" ? spaltenTypen : FELD_TYPEN',
                item-title='label',
                item-value='typ',
                :model-value='auswahl.obj.typ',
                :readonly='readonly',
                @update:model-value='typGewaehlt'
              )
              template(v-if='auswahl.obj.typ !== "info"')
                v-text-field(
                  label='Interne Bezeichnung (Platzhalter in der DOCX)',
                  v-model='auswahl.obj.key',
                  :readonly='readonly',
                  :rules='[hoechstens(GRENZEN.keyLaenge)]',
                  hint='Buchstaben, Ziffern und _; wird aus der Beschriftung vorgeschlagen, bis du sie selbst änderst.',
                  persistent-hint,
                  @update:model-value='autoKey.delete(auswahl.obj.id)'
                )
                v-checkbox(
                  label='Pflichtfeld',
                  v-model='auswahl.obj.pflicht',
                  :readonly='readonly',
                  density='compact',
                  :hint='auswahl.obj.typ === "checkbox" ? "Pflicht-Checkbox = muss angekreuzt werden (Zustimmung)." : ""',
                  :persistent-hint='auswahl.obj.typ === "checkbox"'
                )
              v-alert.mb-2(
                v-if='auswahl.obj.typ === "foto"',
                type='info',
                variant='tonal',
                density='compact'
              )
                | Der Browser verkleinert das Bild vor dem Speichern auf höchstens
                | {{ FOTO_MAX_PX }} px (JPEG). Es liegt dann in den Antworten des Kreises
                | und kommt per IMAGE-Platzhalter (siehe unten) in die DOCX. Den Platzhalter
                | in einen normalen Absatz oder eine Tabellenzelle ohne feste Höhe setzen,
                | nicht in ein Textfeld: dort wird das Bild abgeschnitten.
              v-textarea(
                :label='auswahl.obj.typ === "info" ? "Text" : "Hilfetext"',
                v-model='auswahl.obj.hilfe',
                :readonly='readonly',
                :rules='[hoechstens(GRENZEN.hilfeLaenge)]',
                :counter='GRENZEN.hilfeLaenge',
                rows='2',
                auto-grow
              )

              //- Wertebereich: je Typ andere Grenzen, der Server behält nur
              //- die passenden. Die Kreis-Formulare prüfen dagegen.
              template(v-if='auswahl.obj.typ === "date"')
                .text-subtitle-2.mt-4 Erlaubter Zeitraum
                .text-caption.text-medium-emphasis.mb-2
                  | Relativ zum Tag, an dem der Kreis ausfüllt („heute“, +1y = ein Jahr
                  | später, -3m = drei Monate früher, +14d = 14 Tage später; höchstens
                  | {{ RELATIV_MAX_JAHRE }} Jahre) – gilt so in jedem Jahr. Oder ein festes
                  | Datum. Leer = keine Grenze.
                .d-flex.align-start.ga-3.mb-2(v-for='g in DATUM_GRENZEN', :key='g.feld')
                  v-btn-toggle.mt-1(
                    :model-value='datumsArt(auswahl.obj, g.feld)',
                    density='compact',
                    mandatory,
                    variant='outlined',
                    :disabled='readonly',
                    @update:model-value='(v) => datumsArtSetzen(auswahl.obj, g.feld, v)'
                  )
                    v-btn(value='relativ', size='small') relativ
                    v-btn(value='fest', size='small') fest
                  v-text-field(
                    v-if='datumsArt(auswahl.obj, g.feld) === "fest"',
                    type='date',
                    :label='g.label',
                    :model-value='auswahl.obj.regeln[g.feld]',
                    :readonly='readonly',
                    :clearable='!readonly',
                    density='compact',
                    hint='festes Datum, leer = keine Grenze',
                    persistent-hint,
                    @update:model-value='(v) => setzeDatumRegel(g.feld, v)'
                  )
                  v-text-field(
                    v-else,
                    :label='g.label',
                    :model-value='auswahl.obj.regeln[g.feld]',
                    :readonly='readonly',
                    :rules='[hoechstens(GRENZEN.regelAusdruckLaenge), datumsAusdruck]',
                    :placeholder='g.beispiel',
                    density='compact',
                    :hint='datumsVorschau(auswahl.obj.regeln[g.feld])',
                    persistent-hint,
                    @update:model-value='(v) => setzeDatumRegel(g.feld, v)'
                  )
                .text-caption(v-if='regelHinweis(auswahl.obj, heute)')
                  v-icon.mr-1(size='x-small') preview
                  | Für einen Kreis, der heute ausfüllt: {{ regelHinweis(auswahl.obj, heute) }}
              template(v-else-if='auswahl.obj.typ === "number"')
                .text-subtitle-2.mt-4 Erlaubter Wertebereich
                .d-flex.ga-4
                  v-text-field(
                    label='Minimum (leer = keine Grenze)',
                    type='number',
                    :model-value='auswahl.obj.regeln.min',
                    :readonly='readonly',
                    @update:model-value='(v) => setzeZahlRegel("min", v)'
                  )
                  v-text-field(
                    label='Maximum (leer = keine Grenze)',
                    type='number',
                    :model-value='auswahl.obj.regeln.max',
                    :readonly='readonly',
                    @update:model-value='(v) => setzeZahlRegel("max", v)'
                  )
              template(v-else-if='auswahl.obj.typ === "text" || auswahl.obj.typ === "textarea"')
                .text-subtitle-2.mt-4 Textlänge
                .d-flex.ga-4
                  v-text-field(
                    label='Mindestens (0 = egal)',
                    type='number',
                    :model-value='auswahl.obj.regeln.minLaenge',
                    :readonly='readonly',
                    @update:model-value='(v) => setzeLaengenRegel("minLaenge", v)'
                  )
                  v-text-field(
                    label='Höchstens (0 = Servergrenze)',
                    type='number',
                    :model-value='auswahl.obj.regeln.maxLaenge',
                    :readonly='readonly',
                    :hint='`Der Server nimmt nie mehr als ${textGrenzeVon(auswahl.obj.typ)} Zeichen.`',
                    persistent-hint,
                    @update:model-value='(v) => setzeLaengenRegel("maxLaenge", v)'
                  )

              //- Erinnerung: nur Datumsfelder haben einen Termin, an den die
              //- API erinnern kann (z. B. "nächste Überprüfung am").
              template(v-if='auswahl.obj.typ === "date"')
                .text-subtitle-2.mt-4 Erinnerung per Mail
                v-checkbox(
                  label='An dieses Datum erinnern',
                  v-model='auswahl.obj.erinnerung.aktiv',
                  :readonly='readonly',
                  density='compact',
                  hide-details='auto',
                  hint='Mail an den EC-Kreis, sobald sein veröffentlichter Stand dieses Datum enthält.',
                  persistent-hint
                )
                template(v-if='auswahl.obj.erinnerung.aktiv')
                  //- Combobox: Vorschläge anklicken oder eigene Zahl tippen
                  //- (Enter); jeder Eintrag ein Chip mit x.
                  v-combobox.mt-3(
                    label='Tage vorher',
                    :model-value='auswahl.obj.erinnerung.tageVorher',
                    :items='TAGE_VORSCHLAEGE',
                    multiple,
                    chips,
                    :closable-chips='!readonly',
                    :readonly='readonly',
                    density='compact',
                    :hint='`0 = am Tag selbst; höchstens ${GRENZEN.maxErinnerungen} Einträge, bis ${GRENZEN.tageVorherMax} Tage. Eigene Zahl eintippen und Enter drücken.`',
                    persistent-hint,
                    @update:model-value='tageVorherSetzen'
                  )
                    template(#chip='{ props: chipProps, item }')
                      v-chip(v-bind='chipProps') {{ tageText(item) }}
                    template(#item='{ props: itemProps, item }')
                      v-list-item(v-bind='itemProps', :title='tageText(item)')
                  v-checkbox(
                    :label='`Danach wöchentlich erinnern (höchstens ${UEBERFAELLIG_MAX_WOCHEN} Wochen)`',
                    v-model='auswahl.obj.erinnerung.ueberfaelligWoechentlich',
                    :readonly='readonly',
                    density='compact',
                    hide-details='auto'
                  )

              template(v-if='hatAusgabewerte(auswahl.obj.typ)')
                .text-subtitle-2.mt-2 Ausgabe in der DOCX
                .d-flex.ga-4
                  v-text-field(
                    label='Wenn angekreuzt',
                    v-model='auswahl.obj.wertAn',
                    :readonly='readonly',
                    :rules='[hoechstens(GRENZEN.wertLaenge)]',
                    hint='z. B. X oder ☒',
                    persistent-hint
                  )
                  v-text-field(
                    label='Wenn nicht angekreuzt',
                    v-model='auswahl.obj.wertAus',
                    :readonly='readonly',
                    :rules='[hoechstens(GRENZEN.wertLaenge)]',
                    hint='leer lassen oder z. B. ☐',
                    persistent-hint
                  )

              template(v-if='hatOptionen(auswahl.obj.typ)')
                .text-subtitle-2.mt-4.mb-2 Optionen
                .d-flex.align-center.ga-2.mb-2(v-for='(o, oi) in auswahl.obj.optionen', :key='o.id')
                  v-text-field(
                    label='Beschriftung',
                    v-model='o.label',
                    :readonly='readonly',
                    :rules='[hoechstens(GRENZEN.labelLaenge)]',
                    density='compact',
                    hide-details='auto',
                    @update:model-value='optionLabelGeaendert(o)'
                  )
                  v-text-field(
                    label='Schlüssel',
                    v-model='o.key',
                    :readonly='readonly',
                    :rules='[hoechstens(GRENZEN.keyLaenge)]',
                    density='compact',
                    hide-details='auto',
                    style='max-width: 170px',
                    @update:model-value='autoKey.delete(o.id)'
                  )
                  template(v-if='!readonly')
                    v-btn(icon, size='x-small', variant='text', :disabled='oi === 0', @click='verschiebe(auswahl.obj.optionen, oi, -1)')
                      v-icon arrow_upward
                    v-btn(icon, size='x-small', variant='text', :disabled='oi === auswahl.obj.optionen.length - 1', @click='verschiebe(auswahl.obj.optionen, oi, 1)')
                      v-icon arrow_downward
                    v-btn(icon, size='x-small', variant='text', @click='auswahl.obj.optionen.splice(oi, 1)')
                      v-icon delete
                v-btn(
                  v-if='!readonly',
                  size='small',
                  variant='tonal',
                  prepend-icon='add',
                  :disabled='auswahl.obj.optionen.length >= GRENZEN.maxOptionen',
                  @click='neueOption(auswahl.obj)'
                ) Option

              template(v-if='auswahl.obj.typ === "gruppe"')
                .text-subtitle-2.mt-4 Tabelle
                v-text-field(
                  label='Bezeichnung eines Eintrags',
                  v-model='auswahl.obj.eintragLabel',
                  :readonly='readonly',
                  :rules='[hoechstens(GRENZEN.eintragLabelLaenge)]',
                  placeholder='z. B. Gruppenraum'
                )
                .d-flex.ga-4
                  v-text-field(
                    label='Mindestens (0 = egal)',
                    type='number',
                    :model-value='auswahl.obj.minEintraege',
                    :readonly='readonly',
                    @update:model-value='(v) => setzeGrenze("minEintraege", v)'
                  )
                  v-text-field(
                    label='Höchstens (0 = unbegrenzt)',
                    type='number',
                    :model-value='auswahl.obj.maxEintraege',
                    :readonly='readonly',
                    @update:model-value='(v) => setzeGrenze("maxEintraege", v)'
                  )
                .text-body-2.text-medium-emphasis
                  | {{ auswahl.obj.felder.length }} Spalten – die Spalten bearbeitest du links im Baum.
                v-btn.mt-2(
                  v-if='!readonly',
                  size='small',
                  variant='tonal',
                  prepend-icon='add',
                  :disabled='auswahl.obj.felder.length >= GRENZEN.maxSpalten',
                  @click='neueSpalte(auswahl.obj)'
                ) Spalte

              template(v-if='auswahl.obj.typ !== "info" && auswahl.obj.key')
                .text-subtitle-2.mt-4 Platzhalter
                .d-flex.flex-wrap.ga-1
                  code.platzhalter(v-for='p in platzhalterFuer(auswahl.obj, auswahl.gruppe)', :key='p') {{ p }}

              template(v-if='auswahl.art === "feld" && !readonly')
                v-select.mt-4(
                  label='Verschieben nach Abschnitt …',
                  :items='verschiebeZiele',
                  :model-value='null',
                  density='compact',
                  hint='Behält die ID – die Antworten der EC-Kreise werden übernommen.',
                  persistent-hint,
                  @update:model-value='verschiebeNach'
                )

            v-alert.mt-4(v-if='!readonly && auswahl.art !== "bereich"', type='info', variant='tonal', density='compact')
              | Antworten der EC-Kreise werden in eine neue Formularversion über die interne ID
              | übernommen. Löschen und neu anlegen erzeugt eine neue ID – dann gehen die Antworten
              | verloren, auch bei gleicher interner Bezeichnung. Zum Umstrukturieren verschieben statt neu anlegen.

        v-alert(v-else, type='info', variant='tonal')
          | Links ein Element auswählen. Bereiche sind die Schritte im Stepper,
          | Abschnitte die Cards darin, Felder die Eingaben.

    //- ---------------------------------------------------------- Vorlagen --
    div(v-else-if='tab === "vorlagen"')
      .d-flex.align-center.ga-2.mb-4
        .text-body-2.text-medium-emphasis
          | Aus jeder Vorlage entsteht beim Veröffentlichen eines Kreis-Stands ein PDF.
        v-spacer
        v-btn(
          v-if='!readonly',
          variant='flat',
          v-accent-bg,
          v-white,
          prepend-icon='upload',
          :loading='laedtHoch',
          @click='dateiWaehlen(null)'
        ) DOCX hochladen
        input(
          ref='dateiInput',
          type='file',
          accept='.docx,.docm',
          style='display: none',
          @change='dateiGewaehlt'
        )

      v-alert.mb-4(v-if='!vorlagen.length', type='info', variant='tonal')
        | Noch keine Vorlage. Zum Veröffentlichen ist mindestens eine DOCX-Vorlage nötig.

      v-card.mb-3(v-for='v in vorlagen', :key='v.vorlageID', variant='outlined')
        v-card-text
          .d-flex.align-center.flex-wrap.ga-2
            v-text-field(
              label='Bezeichnung',
              :model-value='v.bezeichnung',
              :readonly='readonly',
              density='compact',
              hide-details,
              style='max-width: 360px',
              @change='bezeichnungAendern(v, $event)'
            )
            .text-caption.text-medium-emphasis {{ v.dateiname }} · {{ groesse(v.groesse) }} · {{ datumZeit(v.erstellt) }}
            v-spacer
            v-btn(size='small', variant='text', prepend-icon='download', @click='vorlageLaden(v)') DOCX
            v-btn(size='small', variant='text', prepend-icon='picture_as_pdf', :loading='testLaeuft === v.vorlageID', @click='testPdf(v)') Test-PDF
            template(v-if='!readonly')
              v-btn(size='small', variant='text', prepend-icon='sync', @click='dateiWaehlen(v)') Ersetzen
              v-btn(icon, size='small', variant='text', title='Vorlage löschen', @click='vorlageLoeschen(v)')
                v-icon delete
          .mt-3
            .text-caption.mb-1 Platzhalter in der Vorlage ({{ v.platzhalter.length }})
            .d-flex.flex-wrap.ga-1
              v-chip(
                v-for='p in v.platzhalter',
                :key='p',
                size='small',
                :color='bekannteSchluessel.has(p) ? "green" : "orange"',
                :variant='bekannteSchluessel.has(p) ? "tonal" : "flat"',
                :title='bekannteSchluessel.has(p) ? "passt zum Formular" : "gibt es im Formular nicht – bleibt leer"'
              ) {{ p }}
              span.text-caption.text-medium-emphasis(v-if='!v.platzhalter.length') keine gefunden

      v-expansion-panels.mt-4
        v-expansion-panel(title='Wie schreibe ich Platzhalter in die DOCX?')
          v-expansion-panel-text
            .text-body-2
              p.mb-2
                | Platzhalter stehen in doppelten geschweiften Klammern und heißen wie die
                | interne Bezeichnung eines Feldes:
                code.ml-1 {{ hilfe.einfach }}
              ul.ml-6.mb-2
                li Checkbox: gibt „Wenn angekreuzt“ bzw. „Wenn nicht angekreuzt“ aus.
                li
                  | Auswahl/Radio/Mehrfachauswahl:
                  code {{ hilfe.auswahl }}
                  |  gibt die gewählte(n) Beschriftung(en) aus,
                  code {{ hilfe.option }}
                  |  je Option das Kreuz (ideal für Ja/Nein-Spalten).
                li Datum als TT.MM.JJJJ, Zahlen deutsch formatiert, mehrzeiliger Text mit Umbrüchen.
                li
                  | Tabellen als Schleife über Zeilen:
                  code.ml-1 {{ hilfe.zeilen }}
                li
                  | …oder über Spalten (z. B. Räume nebeneinander): in der ersten Zelle
                  code.ml-1 {{ hilfe.spaltenStart }}
                  | , in der Zelle dazwischen
                  code.ml-1 {{ hilfe.spaltenInhalt }}
                  | , in der letzten
                  code.ml-1 {{ hilfe.spaltenEnde }}
                li
                  | Bedingungen:
                  code.ml-1 {{ hilfe.bedingung }}
                li
                  | Foto (Breite und Höhe in cm, die runden Klammern sind Pflicht):
                  code.ml-1 {{ hilfe.foto }}
                  | . Ohne Foto bleibt die Stelle leer; wer stattdessen etwas anderes zeigen will:
                  code.ml-1 {{ hilfe.fotoBedingt }}
                  | . Der Platzhalter gehört in einen normalen Absatz oder eine Tabellenzelle
                  | ohne feste Zeilenhöhe: in Textfeldern und Zeilen mit fester Höhe wird das
                  | Bild am Rand abgeschnitten und ist im PDF nicht zu sehen.
                li
                  | Metadaten:
                  code.ml-1 meta_kreis, meta_datum, meta_stand_version, meta_formular_version, meta_entwurf
        v-expansion-panel(title='Alle Platzhalter dieser Formularversion')
          v-expansion-panel-text
            v-table(density='compact')
              thead
                tr
                  th Platzhalter
                  th Herkunft
              tbody
                tr(v-for='p in allePlatzhalter', :key='p.name')
                  td
                    code {{ p.name }}
                  td.text-caption {{ p.herkunft }}

    //- ---------------------------------------------------------- Vorschau --
    div(v-else-if='tab === "vorschau"')
      v-alert.mb-4(type='info', variant='tonal', density='compact')
        | So sieht das Formular im Schutzkonzept-System aus – mit Beispieldaten,
        | nichts wird gespeichert.
        v-btn.ml-2(size='small', variant='text', @click='vorschauNeu(beispielDaten(def))') Beispieldaten neu
        v-btn(size='small', variant='text', @click='vorschauNeu({})') Leeren
      .d-flex.align-center.ga-2.mb-2
        v-progress-linear(:model-value='vorschauFortschritt', color='primary', height='10', rounded)
        span.text-caption.text-no-wrap {{ vorschauFortschritt }} %
      //- Dieselben Sperren wie beim Veröffentlichen eines Kreis-Stands, live
      //- auf den Vorschaudaten -- so sieht der Verwalter, was seine Regeln tun.
      .d-flex.flex-wrap.ga-2.mb-3
        v-chip(size='small', :color='vorschauFehlend.length ? "orange" : "green"', variant='tonal')
          | {{ vorschauFehlend.length }} Pflichtangaben offen
        v-chip(size='small', :color='vorschauVerstoesse.length ? "red" : "green"', variant='tonal')
          | {{ vorschauVerstoesse.length }} Regelverstöße
        v-chip(v-if='def.einstellungen.abschnitteBestaetigen', size='small', :color='vorschauUnbestaetigt.length ? "orange" : "green"', variant='tonal')
          | {{ vorschauUnbestaetigt.length }} Abschnitte unbestätigt
      v-tabs.mb-4(v-model='vorschauBereich', density='compact', show-arrows)
        v-tab(v-for='(b, bi) in def.bereiche', :key='b.id', :value='bi') {{ bi + 1 }}. {{ b.titel }}
      template(v-if='def.bereiche[vorschauBereich]')
        .text-body-2.text-medium-emphasis.mb-3.text-pre(v-if='def.bereiche[vorschauBereich].beschreibung') {{ def.bereiche[vorschauBereich].beschreibung }}
        abschnitt(
          v-for='a in def.bereiche[vorschauBereich].abschnitte',
          :key='a.id',
          v-model:daten='vorschauDaten',
          :abschnitt='a',
          :heute='heute',
          :markiere-fehlend='vorschauMarkieren',
          :bestaetigen-aktiv='def.einstellungen.abschnitteBestaetigen',
          :bestaetigt='vorschauBestaetigt.includes(a.id)',
          @update:bestaetigt='(v) => vorschauBestaetigen(a.id, v)'
        )
        v-btn.mt-2(size='small', variant='tonal', @click='vorschauMarkieren = !vorschauMarkieren')
          | {{ vorschauMarkieren ? 'Markierung ausblenden' : 'Fehlendes und Verstöße markieren' }}

    //- ---------------------------------------------------------- Prüfung --
    div(v-else-if='tab === "pruefung"')
      template(v-if='serverFehler.length')
        .text-subtitle-2.mb-1 Beim letzten Veröffentlichen meldete der Server
        v-list.mb-4(density='compact')
          v-list-item(
            v-for='(p, i) in serverFehler',
            :key='`s${i}`',
            @click='springe(p)'
          )
            template(#prepend)
              v-icon(color='red') report
            v-list-item-title.text-wrap {{ p.text }}
      v-alert.mb-4(
        v-if='!pruefung.fehler.length && !pruefung.warnungen.length',
        type='success',
        variant='tonal'
      ) Keine Probleme gefunden.
      v-list(density='compact', v-if='pruefung.fehler.length || pruefung.warnungen.length')
        v-list-item(
          v-for='(p, i) in pruefung.fehler',
          :key='`f${i}`',
          @click='springe(p)'
        )
          template(#prepend)
            v-icon(color='red') error
          v-list-item-title.text-wrap {{ p.text }}
        v-list-item(
          v-for='(p, i) in pruefung.warnungen',
          :key='`w${i}`',
          @click='springe(p)'
        )
          template(#prepend)
            v-icon(color='orange') warning
          v-list-item-title.text-wrap {{ p.text }}
      .text-caption.text-medium-emphasis.mt-2
        | Fehler verhindern das Veröffentlichen, Warnungen nicht. Die Prüfung läuft
        | live auf dem aktuellen (auch ungespeicherten) Stand.
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useApi } from '../../../../plugins/api'
import { useLogin } from '../../../../plugins/auth'
import { useDialog } from '../../../../plugins/dialog'
import { useRouter } from '../../../../plugins/router'
import saveBlob from '../../../../util/download.util'
import {
  leseEntwurf,
  loescheEntwurf,
  schreibeEntwurf
} from '../../../../util/skEntwurf.util'
import abschnitt from '../../../../schutzkonzept/abschnitt.vue'
import { datum, datumZeit, groesse } from '../../../../schutzkonzept/format'
import {
  ERINNERUNG_STANDARD_TAGE,
  FELD_TYPEN,
  FOTO_MAX_PX,
  GRENZEN,
  META_KEYS,
  RELATIV_MAX_JAHRE,
  UEBERFAELLIG_MAX_WOCHEN,
  beispielDaten,
  fehlendePflichtfelder,
  fortschritt,
  gueltigerDatumAusdruck,
  gueltigesIsoDatum,
  hatOptionen,
  heuteISO,
  neueId,
  normalisiereDefinition,
  parseRelativDatum,
  pruefeDefinition,
  regelHinweis,
  regelVerstoesse,
  slug,
  unbestaetigteAbschnitte,
  type Abschnitt,
  type Bereich,
  type Definition,
  type Erinnerung,
  type Feld,
  type FeldTyp,
  type Option,
  type Problem,
  type Pruefung,
  type Regeln
} from '../../../../schutzkonzept/definition'

/**
 * Formular-Builder einer Schutzkonzept-Formularversion.
 *
 * Bearbeitet wird eine lokale Kopie der Definition; gespeichert wird sie als
 * Ganzes mit optimistischer Sperre (revision). Die Prüfung läuft mit
 * demselben Code wie auf dem Server (definition.ts) live mit, damit Fehler
 * sichtbar sind, bevor jemand auf "Veröffentlichen" drückt.
 *
 * Veröffentlichte Versionen sind eingefroren -- die Seite zeigt sie dann nur
 * noch an. Die Datenbank würde jede Änderung ohnehin ablehnen.
 */
interface VersionAntwort {
  version: {
    formularVersionID: number
    versionNr: number
    status: 'draft' | 'published'
    notiz: string
    revision: number
    erstelltVon: string
    erstellt: string
    publishedAm: string | null
    publishedVon: string | null
    definition: Definition
  }
  vorlagen: Vorlage[]
  pruefung: Pruefung
}

interface Vorlage {
  vorlageID: number
  bezeichnung: string
  dateiname: string
  sortierung: number
  groesse: number
  platzhalter: string[]
  erstellt: string
}

type Auswahl =
  | { art: 'bereich'; obj: Bereich; gruppe?: undefined }
  | { art: 'abschnitt'; obj: Abschnitt; gruppe?: undefined }
  | { art: 'feld' | 'spalte'; obj: Feld; gruppe?: Feld }

/**
 * Die Notiz kürzt der Server auf 1000 Zeichen (formular.ts, kein Feld der
 * Definition und deshalb nicht in GRENZEN). Alles andere kommt aus GRENZEN.
 */
const NOTIZ_LAENGE = 1000

/**
 * Obergrenze einer DOCX-Vorlage, wie MAX_VORLAGE_BYTES in EC-Api
 * (schutzkonzept/config.ts). Vor dem Upload geprüft: der body-parser der API
 * lehnt Größeres mit einer HTML-413-Seite ab, aus der keine Meldung zu holen ist.
 */
const MAX_VORLAGE_BYTES = 20 * 1024 * 1024

/** Die beiden Datumsgrenzen eines Datumsfelds -- gleicher Editor, andere Regel. */
const DATUM_GRENZEN: {
  feld: 'minDatum' | 'maxDatum'
  label: string
  beispiel: string
}[] = [
  { feld: 'minDatum', label: 'Frühestens', beispiel: 'z. B. heute' },
  { feld: 'maxDatum', label: 'Spätestens', beispiel: 'z. B. +1y' }
]

/** Übliche Vorläufe für Erinnerungen (Combobox-Vorschläge). */
const TAGE_VORSCHLAEGE = [90, 60, 30, 14, 7, 1, 0]

const api = useApi()
const { authToken } = useLogin()
const { error, notifyInfo } = useDialog()
const { route, navigate } = useRouter()
const dateiInput = useTemplateRef<HTMLInputElement>('dateiInput')

const id = computed(() => parseInt(route.value.params.id as string, 10))

const version = ref<VersionAntwort['version'] | null>(null)
const def = ref<Definition | null>(null)
const notiz = ref('')
const revision = ref(0)
const vorlagen = ref<Vorlage[]>([])
const gespeichertStand = ref('')
const draftVorhanden = ref(false)
/** Fehler aus der Server-Prüfung beim Veröffentlichen (Tab „Prüfung“). */
const serverFehler = ref<Problem[]>([])

const laedt = ref(false)
const speichert = ref(false)
const veroeffentlicht = ref(false)
const laedtHoch = ref(false)
const testLaeuft = ref<number | null>(null)

const tab = ref('aufbau')
const auswahlId = ref<string | null>(null)
/** IDs, deren Schlüssel noch automatisch aus der Beschriftung folgt. */
const autoKey = ref(new Set<string>())

const vorschauDaten = ref<Record<string, any>>({})
const vorschauBereich = ref(0)
/** In der Vorschau "bestätigte" Abschnitte -- nur Anschauung, nichts wird gespeichert. */
const vorschauBestaetigt = ref<string[]>([])
const vorschauMarkieren = ref(false)

/**
 * Heutiges Datum (Europe/Berlin) für relative Datumsregeln: Prüfung,
 * Vorschau und Live-Auflösung im Regel-Editor. Beim Laden neu gesetzt,
 * damit eine über Mitternacht offene Seite nicht mit gestern rechnet.
 */
const heute = ref(heuteISO())

/**
 * Gewählte Eingabeart je Datumsgrenze ("<feldId>:minDatum" -> fest/relativ).
 * Ohne Wahl folgt die Art dem Wert: JJJJ-MM-TT ist fest, alles andere relativ.
 */
const datumsArtWahl = ref<Record<string, 'fest' | 'relativ'>>({})

const readonly = computed(() => version.value?.status !== 'draft')

const untertitel = computed(() => {
  const v = version.value
  if (!v) return ''
  return v.status === 'draft'
    ? `Entwurf von ${v.erstelltVon}`
    : `Veröffentlicht ${datumZeit(v.publishedAm)} von ${v.publishedVon ?? '—'}`
})

const aktuellerStand = () => JSON.stringify({ d: def.value, n: notiz.value })
const geaendert = computed(
  () =>
    !readonly.value &&
    !!def.value &&
    aktuellerStand() !== gespeichertStand.value
)

const spaltenTypen = FELD_TYPEN.filter(
  (t) => t.typ !== 'gruppe' && t.typ !== 'info'
)

/* ------------------------------------------------------------- Laden --- */

async function laden() {
  laedt.value = true
  try {
    const [r, liste] = await Promise.all([
      api.get<VersionAntwort>(
        `/portal/schutzkonzept/formular/versionen/${id.value}`
      ),
      api.get<{ versionen: { status: string }[] }>(
        '/portal/schutzkonzept/formular'
      )
    ])
    version.value = r.version
    def.value = r.version.definition
    notiz.value = r.version.notiz
    revision.value = r.version.revision
    vorlagen.value = r.vorlagen
    draftVorhanden.value = liste.versionen.some((v) => v.status === 'draft')
    gespeichertStand.value = aktuellerStand()
    autoKey.value = new Set()
    abgelegt.clear()
    serverFehler.value = []
    heute.value = heuteISO()
    datumsArtWahl.value = {}
    vorschauNeu(beispielDaten(r.version.definition))
    bieteSicherungAn()
    if (auswahlId.value && !finde(auswahlId.value)) auswahlId.value = null
  } finally {
    laedt.value = false
  }
}

/* ------------------------------------------ Sicherung im Browser --- */

/*
 * Ungespeicherte Builder-Arbeit liegt zusätzlich im localStorage, je Version
 * (skEntwurf.util). Grund: Der Portal-Token läuft ab (401 -> Layout meldet ab
 * und schickt zum Login), und ohne Token lässt sich nichts mehr speichern.
 * Ohne diese Sicherung wären Stunden an Umbau in diesem Moment unrettbar.
 * Nach dem erneuten Login (oder nach einem Browser-Absturz) bietet laden()
 * den Stand wieder an; beim bewussten Abmelden löscht ihn das Layout.
 */

/** Schreibt sofort. Die Version kommt aus `version`, nicht aus der Route:
 * beim Routenwechsel ist die Route schon neu, def aber noch der alte Stand. */
function sichereJetzt() {
  if (sicherungsTimer) clearTimeout(sicherungsTimer)
  sicherungsTimer = null
  const vid = version.value?.formularVersionID
  if (!vid || readonly.value) return
  if (!geaendert.value) {
    loescheEntwurf(vid)
    return
  }
  schreibeEntwurf(vid, {
    revision: revision.value,
    stand: aktuellerStand(),
    zeit: new Date().toISOString()
  })
}

let sicherungsTimer: ReturnType<typeof setTimeout> | null = null

// Entprellt: aktuellerStand() serialisiert die ganze Definition.
watch(aktuellerStand, () => {
  if (sicherungsTimer) clearTimeout(sicherungsTimer)
  sicherungsTimer = setTimeout(sichereJetzt, 800)
})

function bieteSicherungAn() {
  const v = version.value
  if (!v) return
  const s = leseEntwurf(v.formularVersionID)
  if (!s) return
  if (readonly.value || s.stand === gespeichertStand.value) {
    loescheEntwurf(v.formularVersionID)
    return
  }
  let wert: { d: Definition; n: string }
  try {
    wert = JSON.parse(s.stand)
    if (!Array.isArray(wert?.d?.bereiche)) throw new Error('kaputt')
  } catch {
    loescheEntwurf(v.formularVersionID)
    return
  }
  const wann = datumZeit(s.zeit)
  const frage =
    s.revision === revision.value
      ? `In diesem Browser liegen ungespeicherte Änderungen an Version ${v.versionNr} vom ${wann}.\n\nWiederherstellen?`
      : `In diesem Browser liegen ungespeicherte Änderungen an Version ${v.versionNr} vom ${wann}.\n\nACHTUNG: Die Version wurde seitdem an anderer Stelle gespeichert. Wiederherstellen und speichern überschreibt diese späteren Änderungen.\n\nTrotzdem wiederherstellen?`
  if (!window.confirm(frage)) {
    loescheEntwurf(v.formularVersionID)
    return
  }
  // Eine Sicherung aus einem älteren Stand kann Felder ohne `regeln` oder
  // `erinnerung` enthalten; daran scheitert die live mitlaufende Prüfung und
  // die Seite bliebe weiß. Nur dann normalisieren -- sonst bleibt der Stand
  // roh, damit Überlängen sichtbar bleiben statt still gekürzt zu werden.
  let stand = wert.d
  try {
    pruefeDefinition(stand)
  } catch {
    stand = normalisiereDefinition(stand)
  }
  def.value = stand
  notiz.value = typeof wert.n === 'string' ? wert.n : ''
  // gespeichertStand bleibt der Server-Stand -> "Ungespeicherte Änderungen"
}

async function ladeVorlagen() {
  const r = await api.get<VersionAntwort>(
    `/portal/schutzkonzept/formular/versionen/${id.value}`
  )
  vorlagen.value = r.vorlagen
}

watch(id, laden, { immediate: true })

/* ----------------------------------------------------------- Auswahl --- */

function finde(elementId: string): Auswahl | null {
  if (!def.value) return null
  for (const b of def.value.bereiche) {
    if (b.id === elementId) return { art: 'bereich', obj: b }
    for (const a of b.abschnitte) {
      if (a.id === elementId) return { art: 'abschnitt', obj: a }
      for (const f of a.felder) {
        if (f.id === elementId) return { art: 'feld', obj: f }
        for (const s of f.felder) {
          if (s.id === elementId) return { art: 'spalte', obj: s, gruppe: f }
        }
      }
    }
  }
  return null
}

const auswahl = computed(() =>
  auswahlId.value ? finde(auswahlId.value) : null
)

function waehle(elementId: string) {
  auswahlId.value = elementId
}

function springe(p: Problem) {
  const ziel = p.feldId || p.abschnittId || p.bereichId
  if (ziel && finde(ziel)) {
    auswahlId.value = ziel
    tab.value = 'aufbau'
  }
}

/* --------------------------------------------------------- Bearbeiten --- */

function verschiebe<T>(liste: T[], i: number, richtung: number) {
  const j = i + richtung
  if (j < 0 || j >= liste.length) return
  const [el] = liste.splice(i, 1)
  liste.splice(j, 0, el)
}

function loesche<T>(liste: T[], i: number, was: string) {
  if (
    !window.confirm(
      `${was} wirklich löschen?\n\nBisherige Antworten der EC-Kreise dazu werden nicht übernommen – auch nicht, wenn du es mit gleicher interner Bezeichnung neu anlegst. Zum Umstrukturieren „Verschieben nach …“ im Editor rechts nutzen.`
    )
  )
    return
  liste.splice(i, 1)
}

/**
 * Wertebereich und Erinnerung sind Pflichtteile eines Felds: pruefeDefinition()
 * liest `f.regeln.minLaenge` und `f.erinnerung.aktiv` ohne Absicherung, und die
 * Prüfung läuft hier bei jeder Änderung live mit. Die Standardwerte sind
 * dieselben wie in normalisiereFeld() -- sonst sähe ein frisch angelegtes Feld
 * direkt nach dem Speichern "geändert" aus.
 */
function leereRegeln(): Regeln {
  return {
    minDatum: '',
    maxDatum: '',
    min: null,
    max: null,
    minLaenge: 0,
    maxLaenge: 0
  }
}

function leereErinnerung(): Erinnerung {
  return {
    aktiv: false,
    tageVorher: [...ERINNERUNG_STANDARD_TAGE],
    ueberfaelligWoechentlich: true
  }
}

function leeresFeld(typ: FeldTyp = 'text'): Feld {
  return {
    id: neueId(),
    key: '',
    label: '',
    hilfe: '',
    typ,
    pflicht: false,
    optionen: [],
    wertAn: 'X',
    wertAus: '',
    felder: [],
    minEintraege: 0,
    maxEintraege: 0,
    eintragLabel: '',
    regeln: leereRegeln(),
    erinnerung: leereErinnerung()
  }
}

function neuerBereich() {
  const b: Bereich = {
    id: neueId(),
    titel: 'Neuer Bereich',
    beschreibung: '',
    abschnitte: []
  }
  def.value!.bereiche.push(b)
  auswahlId.value = b.id
}

function neuerAbschnitt(b: Bereich) {
  const a: Abschnitt = {
    id: neueId(),
    titel: 'Neuer Abschnitt',
    beschreibung: '',
    felder: []
  }
  b.abschnitte.push(a)
  auswahlId.value = a.id
}

function neuesFeld(a: Abschnitt) {
  const f = leeresFeld()
  autoKey.value.add(f.id)
  a.felder.push(f)
  auswahlId.value = f.id
}

function neueSpalte(gruppe: Feld) {
  const s = leeresFeld()
  autoKey.value.add(s.id)
  gruppe.felder.push(s)
  auswahlId.value = s.id
}

function neueOption(f: Feld) {
  const o: Option = { id: neueId(), key: '', label: '' }
  autoKey.value.add(o.id)
  f.optionen.push(o)
}

function labelGeaendert(f: Feld) {
  if (autoKey.value.has(f.id)) f.key = slug(f.label)
}

function optionLabelGeaendert(o: Option) {
  if (autoKey.value.has(o.id)) o.key = slug(o.label)
}

/**
 * Beim Typwechsel beiseitegelegte Optionen/Spalten, je Feld-ID.
 *
 * Der Server wirft Optionen eines Typs ohne Optionen und Spalten einer
 * Nicht-Tabelle beim Speichern weg. Kreis-Antworten werden aber über die IDs
 * der Optionen und Spalten übernommen -- frisch erzeugte Ja/Nein-Optionen beim
 * Zurückwechseln hätten neue IDs, und alle Antworten wären verloren. Deshalb
 * merkt sich der Builder die Originale (samt IDs) bis zum nächsten Laden.
 */
const abgelegt = new Map<
  string,
  {
    optionen?: Option[]
    felder?: Feld[]
    minEintraege?: number
    maxEintraege?: number
    eintragLabel?: string
    pflicht?: boolean
    regeln?: Regeln
    erinnerung?: Erinnerung
  }
>()

/**
 * Die Teile von `regeln` sind je Typ verschieden (Datum / Zahl / Textlänge)
 * und stören sich nicht: Was der aktuelle Stand nicht gesetzt hat, kommt aus
 * der bisherigen Ablage.
 */
function mischeRegeln(aktuell: Regeln, alt?: Regeln): Regeln {
  if (!alt) return { ...aktuell }
  return {
    minDatum: aktuell.minDatum || alt.minDatum,
    maxDatum: aktuell.maxDatum || alt.maxDatum,
    min: aktuell.min ?? alt.min,
    max: aktuell.max ?? alt.max,
    minLaenge: aktuell.minLaenge || alt.minLaenge,
    maxLaenge: aktuell.maxLaenge || alt.maxLaenge
  }
}

/** Im Template gibt es keine TypeScript-Ausdrücke -- Auswahl hier einengen. */
function typGewaehlt(neu: FeldTyp) {
  const a = auswahl.value
  if (a && (a.art === 'feld' || a.art === 'spalte')) typAendern(a.obj, neu)
}

function typAendern(f: Feld, neu: FeldTyp) {
  if (!neu || neu === f.typ) return
  const verliertOptionen =
    hatOptionen(f.typ) && !hatOptionen(neu) && f.optionen.length > 0
  const verliertSpalten = f.typ === 'gruppe' && f.felder.length > 0
  if (verliertOptionen || verliertSpalten) {
    const was = verliertOptionen
      ? `die ${f.optionen.length} Optionen`
      : `die ${f.felder.length} Spalten`
    const typName = FELD_TYPEN.find((t) => t.typ === neu)?.label ?? neu
    if (
      !window.confirm(
        `„${typName}“ hat keine ${verliertOptionen ? 'Optionen' : 'Spalten'}: ${was} fallen beim Speichern weg.\n\nWechselst du vor dem Neuladen der Seite zurück, kommen sie mit denselben IDs wieder. Sonst übernehmen die EC-Kreise ihre bisherigen Antworten zu diesem Feld nicht in die neue Version.\n\nTyp trotzdem ändern?`
      )
    ) {
      return
    }
  }

  const ablage = abgelegt.get(f.id) ?? {}
  if (verliertOptionen) ablage.optionen = f.optionen
  // Auch eine Tabelle OHNE Spalten hat Einstellungen, die der Server beim
  // Speichern verwirft (Mindest-/Höchstzahl, Bezeichnung eines Eintrags).
  if (f.typ === 'gruppe') {
    if (verliertSpalten) ablage.felder = f.felder
    ablage.minEintraege = f.minEintraege
    ablage.maxEintraege = f.maxEintraege
    ablage.eintragLabel = f.eintragLabel
  }
  // Wertebereich und Erinnerung passen nur zu bestimmten Typen; der Server
  // leert die unpassenden Teile beim Speichern. Zurückwechseln soll sie
  // wiederbringen -- deshalb mischen statt überschreiben.
  ablage.regeln = mischeRegeln(f.regeln, ablage.regeln)
  // Nur bei `date` stehen echte Werte in der Erinnerung; sonst die alte Ablage
  // behalten (nach einem Speichern stünde dort überall aktiv=false).
  if (f.typ === 'date' || !ablage.erinnerung) {
    ablage.erinnerung = { ...f.erinnerung }
  }
  if (neu === 'info') ablage.pflicht = f.pflicht
  abgelegt.set(f.id, ablage)

  f.typ = neu

  if (hatOptionen(neu) && f.optionen.length === 0) {
    if (ablage.optionen?.length) {
      f.optionen = ablage.optionen
    } else {
      // Häufigster Fall im Schutzkonzept: Ja/Nein
      f.optionen.push(
        { id: neueId(), key: 'ja', label: 'Ja' },
        { id: neueId(), key: 'nein', label: 'Nein' }
      )
    }
  }
  if (neu === 'gruppe') {
    // Die Tabellen-Einstellungen kommen auch dann zurück, wenn die Tabelle
    // (noch) keine Spalten hatte.
    f.minEintraege = ablage.minEintraege ?? f.minEintraege
    f.maxEintraege = ablage.maxEintraege ?? f.maxEintraege
    f.eintragLabel = ablage.eintragLabel || f.eintragLabel
    if (f.felder.length === 0) {
      if (ablage.felder?.length) {
        f.felder = ablage.felder
      } else {
        const s = leeresFeld()
        s.label = 'Bezeichnung'
        s.key = 'bezeichnung'
        s.pflicht = true
        f.felder.push(s)
        if (!f.eintragLabel) f.eintragLabel = 'Eintrag'
      }
    }
  }
  if (ablage.regeln) f.regeln = { ...ablage.regeln }
  if (neu === 'date' && ablage.erinnerung) {
    f.erinnerung = { ...ablage.erinnerung }
  }
  if (neu === 'info') f.pflicht = false
  else if (ablage.pflicht !== undefined) {
    f.pflicht = ablage.pflicht
    ablage.pflicht = undefined
  }
}

/* ---------------------------------------------------------- Umhängen --- */

/*
 * Kreis-Antworten werden in eine neue Formularversion nur über die stabile
 * Feld-ID übernommen. Löschen und an anderer Stelle neu anlegen erzeugt eine
 * neue ID -- auch bei gleicher interner Bezeichnung sind die Antworten dann
 * weg. Umhängen behält das Objekt samt ID.
 */

/** Liste, in der ein Feld oder Abschnitt gerade steckt. */
function elternListe(
  elementId: string
): { liste: (Feld | Abschnitt)[]; i: number } | null {
  for (const b of def.value?.bereiche ?? []) {
    const ai = b.abschnitte.findIndex((a) => a.id === elementId)
    if (ai >= 0) return { liste: b.abschnitte, i: ai }
    for (const a of b.abschnitte) {
      const fi = a.felder.findIndex((f) => f.id === elementId)
      if (fi >= 0) return { liste: a.felder, i: fi }
    }
  }
  return null
}

/** Ziele für "Verschieben nach …" des ausgewählten Elements. */
const verschiebeZiele = computed<{ title: string; value: string }[]>(() => {
  const a = auswahl.value
  const d = def.value
  if (!a || !d) return []
  if (a.art === 'abschnitt') {
    return d.bereiche
      .filter((b) => !b.abschnitte.includes(a.obj))
      .map((b) => ({
        title: `${d.bereiche.indexOf(b) + 1}. ${b.titel || '(ohne Titel)'}`,
        value: b.id
      }))
  }
  if (a.art === 'feld') {
    return d.bereiche.flatMap((b, bi) =>
      b.abschnitte
        .filter((x) => !x.felder.includes(a.obj))
        .map((x) => ({
          title: `${bi + 1}. ${b.titel || '(ohne Titel)'} › ${x.titel || '(ohne Titel)'}`,
          value: x.id
        }))
    )
  }
  return []
})

function verschiebeNach(zielId: string | null) {
  const a = auswahl.value
  const ziel = zielId ? finde(zielId) : null
  if (!a || !ziel) return
  const quelle = elternListe(a.obj.id)
  if (!quelle) return
  // Das Select springt nach der Auswahl auf null zurück -- ohne Meldung hielte
  // der Verwalter eine nicht ausgeführte Verschiebung für erledigt.
  const zielName =
    'titel' in ziel.obj ? ziel.obj.titel || '(ohne Titel)' : '(ohne Titel)'
  const meldeVoll = (max: number, was: string) => {
    error({
      title: 'Nicht verschoben',
      text: `„${zielName}“ hat bereits ${max} ${was}; mehr speichert der Server nicht.`
    })
  }
  if (a.art === 'abschnitt' && ziel.art === 'bereich') {
    if (ziel.obj.abschnitte.length >= GRENZEN.maxAbschnitte) {
      meldeVoll(GRENZEN.maxAbschnitte, 'Abschnitte')
      return
    }
    quelle.liste.splice(quelle.i, 1)
    ziel.obj.abschnitte.push(a.obj)
  } else if (a.art === 'feld' && ziel.art === 'abschnitt') {
    if (ziel.obj.felder.length >= GRENZEN.maxFelder) {
      meldeVoll(GRENZEN.maxFelder, 'Felder')
      return
    }
    quelle.liste.splice(quelle.i, 1)
    ziel.obj.felder.push(a.obj)
  } else {
    return
  }
  notifyInfo(`Verschoben nach „${zielName}“.`)
}

const hatAusgabewerte = (typ: FeldTyp) => typ === 'checkbox' || hatOptionen(typ)

/** Obergrenze des Servers für Texte (textGrenze in definition.ts ist intern). */
const textGrenzeVon = (typ: FeldTyp) =>
  typ === 'text' ? GRENZEN.textLaenge : GRENZEN.textareaLaenge

function setzeGrenze(feld: 'minEintraege' | 'maxEintraege', v: unknown) {
  const a = auswahl.value
  if (a && (a.art === 'feld' || a.art === 'spalte')) a.obj[feld] = ganz(v)
}

/* ------------------------------------------- Wertebereich / Erinnerung --- */

/** Das ausgewählte Feld -- die Regel-Eingaben gibt es nur für Feld/Spalte. */
function gewaehltesFeld(): Feld | null {
  const a = auswahl.value
  return a && (a.art === 'feld' || a.art === 'spalte') ? a.obj : null
}

/** Zahlengrenzen dürfen leer (= keine Grenze) und negativ sein. */
function setzeZahlRegel(feld: 'min' | 'max', v: unknown) {
  const f = gewaehltesFeld()
  if (!f) return
  const text = String(v ?? '').trim()
  const n = Number(text.replace(',', '.'))
  f.regeln[feld] = text === '' || !Number.isFinite(n) ? null : n
}

function setzeLaengenRegel(feld: 'minLaenge' | 'maxLaenge', v: unknown) {
  const f = gewaehltesFeld()
  if (f) f.regeln[feld] = ganz(v)
}

/* --- Datumsgrenzen: fest (Datums-Input) oder relativ ("+1y") --- */

function datumsArt(f: Feld, feld: 'minDatum' | 'maxDatum'): 'fest' | 'relativ' {
  return (
    datumsArtWahl.value[`${f.id}:${feld}`] ??
    (gueltigesIsoDatum(f.regeln[feld]) ? 'fest' : 'relativ')
  )
}

/** Umschalten leert den Wert, wenn er nicht zur neuen Art passt. */
function datumsArtSetzen(
  f: Feld,
  feld: 'minDatum' | 'maxDatum',
  art: 'fest' | 'relativ' | null
) {
  if (!art || readonly.value) return
  datumsArtWahl.value[`${f.id}:${feld}`] = art
  const istFest = gueltigesIsoDatum(f.regeln[feld])
  if ((art === 'fest' && !istFest) || (art === 'relativ' && istFest)) {
    f.regeln[feld] = ''
  }
}

/** Der Datums-Input liefert beim Leeren null -- die Definition kennt nur ''. */
function setzeDatumRegel(feld: 'minDatum' | 'maxDatum', v: unknown) {
  const f = gewaehltesFeld()
  if (f) f.regeln[feld] = String(v ?? '')
}

/** Vuetify-Rule für relative Ausdrücke. */
const datumsAusdruck = (v: unknown) =>
  gueltigerDatumAusdruck(v) ||
  `Kein Datumsausdruck: heute, +1y, -3m, +14d (höchstens ${RELATIV_MAX_JAHRE} Jahre) oder JJJJ-MM-TT.`

/** Live-Vorschau unter dem Ausdruck: was ergibt er heute? */
function datumsVorschau(ausdruck: unknown): string {
  const a = String(ausdruck ?? '').trim()
  if (!a) return 'leer = keine Grenze'
  if (!gueltigerDatumAusdruck(a)) return 'Beispiele: heute, +1y, -3m, +14d'
  const iso = parseRelativDatum(a, heute.value)
  return iso
    ? `Heute ergibt das: ${datum(iso)}`
    : 'Ergibt kein gültiges Datum (zu weit in der Vergangenheit oder Zukunft).'
}

/* --- Erinnerung: Tage vorher --- */

/** Combobox liefert Zahlen und getippte Strings gemischt -- normalisieren wie der Server. */
function tageVorherSetzen(roh: unknown) {
  const f = gewaehltesFeld()
  if (!f) return
  const liste = Array.isArray(roh) ? roh : [roh]
  const tage = liste
    .map((t) => parseInt(String(t ?? '').trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= GRENZEN.tageVorherMax)
  f.erinnerung.tageVorher = [...new Set(tage)]
    .sort((a, b) => b - a)
    .slice(0, GRENZEN.maxErinnerungen)
}

/**
 * Chip-/Listentext. Die Slots der Combobox liefern ein Listenobjekt
 * ({ raw, value, title }), nicht die Zahl selbst -- je nach Vuetify-Fassung
 * mit anderem Feld belegt, deshalb alle drei probieren.
 */
function tageText(item: unknown): string {
  const roh =
    item && typeof item === 'object'
      ? ((item as any).raw ?? (item as any).value ?? (item as any).title)
      : item
  const z = Number(roh)
  if (!Number.isFinite(z)) return String(roh ?? '')
  if (z === 0) return 'am Tag selbst'
  return z === 1 ? '1 Tag vorher' : `${z} Tage vorher`
}

/* --- Vorschau: Bestätigungen und Prüfstand --- */

function vorschauNeu(daten: Record<string, any>) {
  vorschauDaten.value = daten
  vorschauBestaetigt.value = []
  vorschauMarkieren.value = false
}

function vorschauBestaetigen(abschnittId: string, wert: boolean) {
  const ohne = vorschauBestaetigt.value.filter((x) => x !== abschnittId)
  vorschauBestaetigt.value = wert ? [...ohne, abschnittId] : ohne
}

const vorschauFehlend = computed(() =>
  def.value ? fehlendePflichtfelder(def.value, vorschauDaten.value) : []
)
const vorschauVerstoesse = computed(() =>
  def.value ? regelVerstoesse(def.value, vorschauDaten.value, heute.value) : []
)
const vorschauUnbestaetigt = computed(() =>
  def.value ? unbestaetigteAbschnitte(def.value, vorschauBestaetigt.value) : []
)

function ganz(v: unknown): number {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isInteger(n) && n > 0 ? n : 0
}

const typIcon = (typ: FeldTyp) =>
  ({
    text: 'short_text',
    textarea: 'notes',
    number: 'pin',
    date: 'event',
    select: 'arrow_drop_down_circle',
    radio: 'radio_button_checked',
    multiselect: 'checklist',
    checkbox: 'check_box',
    info: 'info',
    foto: 'photo_camera',
    gruppe: 'table_chart'
  })[typ]

/* ------------------------------------------------------- Platzhalter --- */

function platzhalterFuer(f: Feld, gruppe?: Feld): string[] {
  const k = (name: string) => (gruppe ? `{{$eintrag.${name}}}` : `{{${name}}}`)
  if (f.typ === 'gruppe') {
    return [
      `{{FOR eintrag IN ${f.key}}}`,
      '{{$eintrag.spalte}}',
      '{{END-FOR eintrag}}'
    ]
  }
  if (f.typ === 'foto') {
    // Breite/Hoehe in cm; `data` und `extension` liefert die DOCX-Ausgabe.
    // Die runden Klammern sind Pflicht: docx-templates wertet per eval aus,
    // ein nacktes `{...}` waere dort ein Block und das Bild fehlte still.
    const n = (name: string) => (gruppe ? `$eintrag.${name}` : name)
    return [
      `{{IMAGE ({width: 4, height: 5, data: ${n(f.key)}, extension: ${n(`${f.key}_extension`)}})}}`
    ]
  }
  const liste = [k(f.key)]
  if (hatOptionen(f.typ)) {
    for (const o of f.optionen) if (o.key) liste.push(k(`${f.key}_${o.key}`))
  }
  return liste
}

const bekannteSchluessel = computed(() => {
  const s = new Set<string>(META_KEYS)
  for (const b of def.value?.bereiche ?? []) {
    for (const a of b.abschnitte) {
      for (const f of a.felder) {
        if (f.typ === 'info' || !f.key) continue
        s.add(f.key)
        if (f.typ === 'foto') s.add(`${f.key}_extension`)
        for (const o of f.optionen) s.add(`${f.key}_${o.key}`)
      }
    }
  }
  return s
})

const allePlatzhalter = computed(() => {
  const out: { name: string; herkunft: string }[] = []
  for (const b of def.value?.bereiche ?? []) {
    for (const a of b.abschnitte) {
      for (const f of a.felder) {
        if (f.typ === 'info' || !f.key) continue
        const typ = FELD_TYPEN.find((t) => t.typ === f.typ)?.label ?? f.typ
        out.push({ name: f.key, herkunft: `${b.titel} › ${f.label} (${typ})` })
        if (f.typ === 'foto') {
          out.push({
            name: `${f.key}_extension`,
            herkunft: `Dateityp des Fotos „${f.label}“ (.jpg/.png) für IMAGE`
          })
        }
        for (const o of f.optionen) {
          out.push({
            name: `${f.key}_${o.key}`,
            herkunft: `Option „${o.label}“: „${f.wertAn}“ wenn gewählt, sonst „${f.wertAus}“`
          })
        }
        for (const s of f.felder) {
          out.push({
            name: `$eintrag.${s.key}`,
            herkunft: `Spalte „${s.label}“ in FOR eintrag IN ${f.key}`
          })
          if (s.typ === 'foto') {
            out.push({
              name: `$eintrag.${s.key}_extension`,
              herkunft: `Dateityp des Fotos in Spalte „${s.label}“`
            })
          }
          for (const o of s.optionen) {
            out.push({
              name: `$eintrag.${s.key}_${o.key}`,
              herkunft: `Option „${o.label}“ der Spalte „${s.label}“`
            })
          }
        }
      }
    }
  }
  for (const m of META_KEYS) out.push({ name: m, herkunft: 'Metadaten' })
  return out
})

/** Beispiele als Strings: doppelte geschweifte Klammern direkt im Template wären Vue-Interpolation. */
const hilfe = {
  einfach: '{{kreis_name}}',
  auswahl: '{{gemeindeangebot}}',
  option: '{{krabbelgruppe_ja}}',
  zeilen:
    '{{FOR person IN ansprechpersonen}} {{$person.name}} {{END-FOR person}}',
  spaltenStart: '{{FOR raum IN gruppenraeume}}',
  spaltenInhalt: '{{$raum.name}} / {{$raum.einsehbar}}',
  spaltenEnde: '{{END-FOR raum}}',
  bedingung: '{{IF uebernachtung_ja}} … {{END-IF}}',
  foto: '{{IMAGE ({width: 4, height: 5, data: foto, extension: foto_extension})}}',
  fotoBedingt:
    '{{IMAGE foto ? {width: 4, height: 5, data: foto, extension: foto_extension} : null}}'
}

/* ------------------------------------------------------------ Prüfung --- */

const pruefung = computed<Pruefung>(() => {
  if (!def.value) return { fehler: [], warnungen: [] }
  const p = pruefeDefinition(
    def.value,
    vorlagen.value.map((v) => ({
      vorlage: v.bezeichnung,
      keys: v.platzhalter
    })),
    heute.value
  )
  if (!vorlagen.value.length) {
    p.fehler.push({ text: 'Mindestens eine DOCX-Vorlage hochladen.' })
  }
  p.fehler.push(...grenzVerstoesse.value)
  return p
})

/**
 * Was der Server beim Speichern still abschneiden würde. Blockiert Speichern
 * und Veröffentlichen, bis es gekürzt ist -- der Verwalter entscheidet, was
 * wegfällt, nicht slice().
 */
const grenzVerstoesse = computed<Problem[]>(() => {
  const out: Problem[] = []
  const d = def.value
  if (!d) return out
  const lang = (wert: string, max: number) => (wert ?? '').length > max
  const zuLang = (was: string, max: number, wo: Omit<Problem, 'text'>) =>
    out.push({ ...wo, text: `${was}: höchstens ${max} Zeichen.` })

  if (lang(notiz.value, NOTIZ_LAENGE)) {
    zuLang('Notiz zur Version', NOTIZ_LAENGE, {})
  }
  if (d.bereiche.length > GRENZEN.maxBereiche) {
    out.push({ text: `Höchstens ${GRENZEN.maxBereiche} Bereiche.` })
  }
  const feldPruefen = (f: Feld, wo: Omit<Problem, 'text'>, name: string) => {
    if (lang(f.label, GRENZEN.labelLaenge))
      zuLang(`${name}: Beschriftung`, GRENZEN.labelLaenge, wo)
    if (lang(f.hilfe, GRENZEN.hilfeLaenge))
      zuLang(
        `${name}: ${f.typ === 'info' ? 'Text' : 'Hilfetext'}`,
        GRENZEN.hilfeLaenge,
        wo
      )
    if (lang(f.key, GRENZEN.keyLaenge))
      zuLang(`${name}: Interne Bezeichnung`, GRENZEN.keyLaenge, wo)
    if (
      lang(f.wertAn, GRENZEN.wertLaenge) ||
      lang(f.wertAus, GRENZEN.wertLaenge)
    )
      zuLang(`${name}: Ausgabe in der DOCX`, GRENZEN.wertLaenge, wo)
    if (hatOptionen(f.typ)) {
      if (f.optionen.length > GRENZEN.maxOptionen)
        out.push({
          ...wo,
          text: `${name}: höchstens ${GRENZEN.maxOptionen} Optionen.`
        })
      for (const o of f.optionen) {
        if (
          lang(o.label, GRENZEN.labelLaenge) ||
          lang(o.key, GRENZEN.keyLaenge)
        )
          out.push({
            ...wo,
            text: `${name}, Option „${o.label.slice(0, 40)}“: Beschriftung höchstens ${GRENZEN.labelLaenge}, Schlüssel höchstens ${GRENZEN.keyLaenge} Zeichen.`
          })
      }
    }
    if (f.typ === 'gruppe') {
      if (lang(f.eintragLabel, GRENZEN.eintragLabelLaenge))
        zuLang(
          `${name}: Bezeichnung eines Eintrags`,
          GRENZEN.eintragLabelLaenge,
          wo
        )
      if (f.felder.length > GRENZEN.maxSpalten)
        out.push({
          ...wo,
          text: `${name}: höchstens ${GRENZEN.maxSpalten} Spalten.`
        })
    }
    if (
      lang(f.regeln.minDatum, GRENZEN.regelAusdruckLaenge) ||
      lang(f.regeln.maxDatum, GRENZEN.regelAusdruckLaenge)
    )
      zuLang(`${name}: Erlaubter Zeitraum`, GRENZEN.regelAusdruckLaenge, wo)
  }

  for (const b of d.bereiche) {
    const bName = `Bereich „${b.titel.slice(0, 40)}“`
    if (lang(b.titel, GRENZEN.labelLaenge))
      zuLang(`${bName}: Titel`, GRENZEN.labelLaenge, { bereichId: b.id })
    if (lang(b.beschreibung, GRENZEN.hilfeLaenge))
      zuLang(`${bName}: Beschreibung`, GRENZEN.hilfeLaenge, { bereichId: b.id })
    if (b.abschnitte.length > GRENZEN.maxAbschnitte)
      out.push({
        bereichId: b.id,
        text: `${bName}: höchstens ${GRENZEN.maxAbschnitte} Abschnitte.`
      })
    for (const a of b.abschnitte) {
      const aWo = { bereichId: b.id, abschnittId: a.id }
      const aName = `Abschnitt „${a.titel.slice(0, 40)}“`
      if (lang(a.titel, GRENZEN.labelLaenge))
        zuLang(`${aName}: Titel`, GRENZEN.labelLaenge, aWo)
      if (lang(a.beschreibung, GRENZEN.hilfeLaenge))
        zuLang(`${aName}: Beschreibung`, GRENZEN.hilfeLaenge, aWo)
      if (a.felder.length > GRENZEN.maxFelder)
        out.push({
          ...aWo,
          text: `${aName}: höchstens ${GRENZEN.maxFelder} Felder.`
        })
      for (const f of a.felder) {
        const fName = `Feld „${f.label.slice(0, 40)}“`
        feldPruefen(f, { ...aWo, feldId: f.id }, fName)
        if (f.typ !== 'gruppe') continue
        for (const s of f.felder) {
          feldPruefen(
            s,
            { ...aWo, feldId: s.id },
            `${fName}, Spalte „${s.label.slice(0, 40)}“`
          )
        }
      }
    }
  }
  return out
})

/** Vuetify-Regel für die Textfelder des Editors (zeigt die Grenze sofort). */
const hoechstens = (max: number) => (v: unknown) =>
  String(v ?? '').length <= max || `Höchstens ${max} Zeichen.`

const vorschauFortschritt = computed(() =>
  def.value ? fortschritt(def.value, vorschauDaten.value) : 0
)

/* ---------------------------------------------------------- Speichern --- */

/**
 * Laufender PUT. Zwei PUTs mit derselben Revision (Speichern und gleich
 * danach Veröffentlichen oder Test-PDF) erzeugten sonst einen Konflikt mit
 * sich selbst: der zweite schickt die Revision, die der erste schon erhöht hat.
 */
let laufendesSpeichern: Promise<boolean> | null = null

async function speichern(): Promise<boolean> {
  while (laufendesSpeichern) {
    const ok = await laufendesSpeichern
    if (!ok) return false
    // Nach dem ersten PUT ist womöglich schon alles gespeichert.
    if (!geaendert.value) return true
  }
  laufendesSpeichern = speichernEinmal()
  try {
    return await laufendesSpeichern
  } finally {
    laufendesSpeichern = null
  }
}

async function speichernEinmal(): Promise<boolean> {
  if (!def.value || readonly.value) return false
  const grenzen = grenzVerstoesse.value
  if (grenzen.length) {
    tab.value = 'pruefung'
    error({
      title: 'Nicht gespeichert',
      text: `${grenzen.length} Angabe(n) überschreiten eine Obergrenze und würden beim Speichern abgeschnitten. Sie stehen im Tab „Prüfung“.`
    })
    return false
  }
  // Schnappschuss: Der Editor bleibt während des Requests bedienbar. Was
  // danach geändert wird, ist NICHT gespeichert und darf weder überschrieben
  // noch als gespeichert markiert werden.
  const gesendet = aktuellerStand()
  const { d: gesendeteDef, n: gesendeteNotiz } = JSON.parse(gesendet) as {
    d: Definition
    n: string
  }
  speichert.value = true
  try {
    const r = await api.request<{ revision: number; definition: Definition }>(
      `/portal/schutzkonzept/formular/versionen/${id.value}`,
      {
        method: 'PUT',
        body: {
          revision: revision.value,
          definition: gesendeteDef,
          notiz: gesendeteNotiz
        },
        quiet: true
      }
    )
    revision.value = r.revision
    const serverStand = JSON.stringify({ d: r.definition, n: gesendeteNotiz })
    if (aktuellerStand() === gesendet) {
      // Der Server normalisiert (Standardwerte, Längen) -- dessen Fassung gilt.
      def.value = r.definition
      gespeichertStand.value = aktuellerStand()
    } else {
      // Inzwischen weiter bearbeitet: lokalen Stand behalten, er bleibt als
      // "ungespeichert" markiert, der Leave-Guard fragt weiter.
      gespeichertStand.value = serverStand
    }
    sichereJetzt()
    notifyInfo('Gespeichert.')
    return true
  } catch (err: any) {
    sichereJetzt()
    // 401: Das Layout meldet ab und schickt zum Login, der Stand ist eben
    // gesichert. Ein Fehlerdialog stünde nur über der Login-Seite.
    if (err.status === 401) return false
    error({
      title:
        err.code === 'CONFLICT'
          ? 'Zwischenzeitlich geändert'
          : 'Speichern fehlgeschlagen',
      text:
        err.code === 'CONFLICT'
          ? 'Diese Version wurde inzwischen an anderer Stelle gespeichert. Bitte die Seite neu laden. Deine ungespeicherten Änderungen sind in diesem Browser gesichert und werden danach zur Wiederherstellung angeboten – sie würden die anderen Änderungen dann aber überschreiben.'
          : err.message
    })
    return false
  } finally {
    speichert.value = false
  }
}

async function veroeffentlichen() {
  if (pruefung.value.fehler.length) {
    tab.value = 'pruefung'
    error({
      title: 'Noch nicht veröffentlichbar',
      text: `Die Version hat noch ${pruefung.value.fehler.length} Fehler. Sie stehen im Tab „Prüfung“.`
    })
    return
  }
  if (
    !window.confirm(
      `Version ${version.value?.versionNr} jetzt veröffentlichen?\n\nDanach ist sie unveränderlich. Alle EC-Kreise bearbeiten ab sofort auf dieser Version; ihre bisherigen Angaben werden beim nächsten Öffnen übernommen.`
    )
  ) {
    return
  }
  veroeffentlicht.value = true
  serverFehler.value = []
  try {
    // speichern() wartet einen schon laufenden PUT ab, bevor es geaendert
    // prüft -- sonst ginge ein zweiter PUT mit veralteter Revision raus.
    if (laufendesSpeichern || geaendert.value) {
      if (!(await speichern())) return
    }
    // Während des PUT weiter bearbeitet? Dann würde eine Fassung
    // veröffentlicht, die nicht der angezeigten entspricht.
    if (geaendert.value) {
      error({
        title: 'Nicht veröffentlicht',
        text: 'Während des Speicherns wurde weiter bearbeitet. Bitte erst speichern und dann erneut veröffentlichen.'
      })
      return
    }
    await api.request(
      `/portal/schutzkonzept/formular/versionen/${id.value}/publish`,
      {
        method: 'POST',
        body: { revision: revision.value },
        quiet: true
      }
    )
    notifyInfo(`Version ${version.value?.versionNr} veröffentlicht.`)
    await laden()
  } catch (err: any) {
    if (err.status === 401) return
    const p = err.details as Pruefung | undefined
    if (p?.fehler?.length) {
      // Eine Aufzählung im Fehlerdialog verliert ihre Zeilenumbrüche
      // (dialogHost ist eine 1:1-Kopie aus EC-Verwaltung) -- die Liste
      // gehört ohnehin dorthin, wo man per Klick zum Feld springt.
      serverFehler.value = p.fehler
      tab.value = 'pruefung'
    }
    error({
      title: 'Veröffentlichen fehlgeschlagen',
      text: p?.fehler?.length
        ? `${err.message} Die ${p.fehler.length} Fehler der Server-Prüfung stehen im Tab „Prüfung“.`
        : err.message
    })
  } finally {
    veroeffentlicht.value = false
  }
}

async function neueVersion() {
  try {
    const r = await api.post<{ formularVersionID: number }>(
      '/portal/schutzkonzept/formular/versionen',
      {
        notiz: ''
      }
    )
    navigate({ path: `/schutzkonzept/version/${r.formularVersionID}` })
  } catch {
    /* Fehlerdialog aus api.ts */
  }
}

/* ----------------------------------------------------------- Vorlagen --- */

let ersetzeVorlage: Vorlage | null = null

function dateiWaehlen(v: Vorlage | null) {
  ersetzeVorlage = v
  dateiInput.value?.click()
}

async function dateiGewaehlt(e: Event) {
  const input = e.target as HTMLInputElement
  const datei = input.files?.[0]
  input.value = ''
  if (!datei) return
  if (datei.size > MAX_VORLAGE_BYTES) {
    error({
      title: 'Datei zu groß',
      text: `„${datei.name}“ hat ${groesse(datei.size)}, erlaubt sind höchstens ${groesse(MAX_VORLAGE_BYTES)}. Meist helfen: eingebettete Schriften abschalten (Word: Datei › Optionen › Speichern) oder große Bilder verkleinern.`
    })
    return
  }
  laedtHoch.value = true
  try {
    if (ersetzeVorlage) {
      await api.upload(
        `/portal/schutzkonzept/formular/versionen/${id.value}/vorlagen/${ersetzeVorlage.vorlageID}`,
        datei,
        { method: 'PUT' }
      )
      notifyInfo(`„${ersetzeVorlage.bezeichnung}“ ersetzt.`)
    } else {
      await api.upload(
        `/portal/schutzkonzept/formular/versionen/${id.value}/vorlagen`,
        datei
      )
      notifyInfo(`„${datei.name}“ hochgeladen.`)
    }
    await ladeVorlagen()
  } catch {
    /* Fehlerdialog aus api.ts */
  } finally {
    laedtHoch.value = false
  }
}

async function bezeichnungAendern(v: Vorlage, e: Event) {
  const b = ((e.target as HTMLInputElement | null)?.value ?? '').trim()
  if (!b || b === v.bezeichnung) return
  try {
    await api.request(
      `/portal/schutzkonzept/formular/versionen/${id.value}/vorlagen/${v.vorlageID}`,
      {
        method: 'PATCH',
        body: { bezeichnung: b }
      }
    )
    v.bezeichnung = b
    notifyInfo('Bezeichnung gespeichert.')
  } catch {
    await ladeVorlagen()
  }
}

async function vorlageLoeschen(v: Vorlage) {
  if (!window.confirm(`Vorlage „${v.bezeichnung}“ aus diesem Entwurf löschen?`))
    return
  try {
    await api.request(
      `/portal/schutzkonzept/formular/versionen/${id.value}/vorlagen/${v.vorlageID}`,
      {
        method: 'DELETE'
      }
    )
    await ladeVorlagen()
  } catch {
    /* Fehlerdialog aus api.ts */
  }
}

async function vorlageLaden(v: Vorlage) {
  const { blob, dateiname } = await api.requestBlob(
    `/portal/schutzkonzept/formular/vorlagen/${v.vorlageID}`
  )
  saveBlob(dateiname, blob)
}

async function testPdf(v: Vorlage) {
  testLaeuft.value = v.vorlageID
  try {
    // Der Server rendert die gespeicherte Definition. Die Platzhalter-Chips
    // zeigen aber den ungespeicherten Stand -- ohne Speichern stünde ein eben
    // umbenannter Key grün da und bliebe im PDF trotzdem leer.
    if (!readonly.value && (laufendesSpeichern || geaendert.value)) {
      if (!(await speichern())) return
    }
    const { blob, dateiname } = await api.requestBlob(
      `/portal/schutzkonzept/formular/versionen/${id.value}/vorlagen/${v.vorlageID}/testpdf`,
      { method: 'POST' }
    )
    saveBlob(dateiname, blob)
  } catch {
    /* Fehlerdialog aus api.ts */
  } finally {
    testLaeuft.value = null
  }
}

/* ------------------------------------------- Ungespeichertes schützen --- */

function darfVerlassen(): boolean {
  if (!geaendert.value) return true
  if (!authToken.value) {
    // Abgemeldet (Token abgelaufen): Speichern geht ohnehin nicht mehr, eine
    // Rückfrage hielte nur auf einer toten Seite fest. Der Stand wird im
    // Browser gesichert und nach dem Login wieder angeboten.
    sichereJetzt()
    return true
  }
  const ok = window.confirm(
    'Es gibt ungespeicherte Änderungen. Seite trotzdem verlassen?'
  )
  if (ok) {
    // Bewusst verworfen -- dann auch nicht später wieder anbieten.
    if (sicherungsTimer) clearTimeout(sicherungsTimer)
    sicherungsTimer = null
    const vid = version.value?.formularVersionID
    if (vid) loescheEntwurf(vid)
  }
  return ok
}

onBeforeRouteLeave(darfVerlassen)

// Alle Versionen teilen sich einen Routen-Eintrag (/schutzkonzept/version/:id),
// die Komponente wird beim Wechsel wiederverwendet: onBeforeRouteLeave feuert
// dann nicht, und watch(id, laden) würde die Änderungen still überschreiben.
onBeforeRouteUpdate((to, from) =>
  to.path === from.path ? true : darfVerlassen()
)

function vorDemSchliessen(e: BeforeUnloadEvent) {
  if (geaendert.value) {
    sichereJetzt()
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => window.addEventListener('beforeunload', vorDemSchliessen))
onBeforeUnmount(() =>
  window.removeEventListener('beforeunload', vorDemSchliessen)
)
</script>

<style scoped>
.baum {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 4px 0;
}
.zeile {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding-right: 4px;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.zeile:hover {
  background: rgba(128, 128, 128, 0.08);
}
.zeile.aktiv {
  background: rgba(143, 178, 23, 0.18);
  border-left-color: #8fb217;
}
.zeile.neu {
  color: rgb(var(--v-theme-primary));
  font-size: 0.875rem;
}
.stufe-0 {
  padding-left: 8px;
}
.stufe-1 {
  padding-left: 28px;
}
.stufe-2 {
  padding-left: 48px;
}
.stufe-3 {
  padding-left: 68px;
}
.platzhalter {
  background: rgba(128, 128, 128, 0.12);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.8rem;
}
.text-pre {
  white-space: pre-line;
}
.text-wrap {
  white-space: normal;
}
.editor-sticky {
  position: sticky;
  top: 8px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}
</style>
