-- The first three treaties, transcribed from the PDFs shared in Discord.
-- The original PDFs live in the documents bucket under seed/.

with keeper as (select id, name from public.members where role = 'keeper' order by created_at limit 1),
ins as (
  insert into public.acts (slug, kind, number, status, title, subtitle, summary, body, pdf_path, pdf_name, pdf_size, pdf_pages,
                           parties, introduced_on, passed_on, created_by, updated_by)
  select v.slug, 'treaty', v.number, 'passed', v.title, v.subtitle, v.summary, v.body, v.pdf_path, v.pdf_name, v.pdf_size, v.pdf_pages,
         v.parties, v.introduced_on, null, keeper.id, keeper.id
  from keeper, (values
  (
    'treaty-1-milan-aegean-federation-agreement', 1,
    'Milan–Aegean Federation Agreement',
    'Agreement between the Republic of Milan and the Aegean Federation. Milano Cumhuriyeti ile Ege Federasyonu Arasında Anlaşma.',
    'Untaxed trade, non-aggression and mutual defence between Milan and the Aegean Federation. The agreement runs for 90 days and renews unless either side objects. Published in English and Turkish.',
    $b$Proposed by the Republic of Milan. Draft for ministerial review.
> Milano Cumhuriyeti tarafından önerilmiştir. Bakanlık incelemesi için taslak.

# 1. Trade
> Ticaret
- Bilateral trade between Milan and the Aegean Federation is untaxed.
> Milano ile Ege Federasyonu arasındaki ikili ticaret vergiden muaftır.
- Prices are negotiated per contract, based on the volume offered.
> Fiyatlar, teklif edilen hacme göre her sözleşme için ayrı ayrı müzakere edilir.
- Neither side may charge the other a higher price than it charges any third state for the same goods and volume.
> Taraflardan hiçbiri, aynı mal ve hacim için herhangi bir üçüncü devlete uyguladığı fiyattan daha yüksek bir fiyatı diğer tarafa uygulayamaz.

# 2. Non-Aggression and Alliance
> Saldırmazlık ve İttifak
- Milan and the Aegean Federation will not declare war on each other while this agreement is active.
> Milano ve Ege Federasyonu, işbu anlaşma yürürlükte olduğu sürece birbirlerine savaş ilan etmeyecektir.
- The agreement lasts 90 days. Seven days before expiry, both sides consult on renewal. If neither objects, it renews for another 90 days.
> Anlaşmanın süresi 90 gündür. Sürenin dolmasından yedi gün önce taraflar yenileme konusunda istişare eder. Taraflardan hiçbiri itiraz etmezse anlaşma 90 gün daha yenilenir.
- Either side may withdraw with 14 days' written notice.
> Taraflardan her biri, 14 gün önceden yazılı bildirimde bulunarak anlaşmadan çekilebilir.

# 3. Mutual Defense
> Karşılıklı Savunma
- If either state is attacked by a third state, both governments negotiate military, economic, or logistical assistance in proportion to the conflict and damage suffered.
> Devletlerden biri üçüncü bir devlet tarafından saldırıya uğrarsa, iki hükümet çatışmanın boyutu ve uğranılan zararla orantılı askeri, ekonomik veya lojistik yardımı müzakere eder.
- Neither side is obliged to enter a war or send aid without its own government's approval.
> Taraflardan hiçbiri, kendi hükümetinin onayı olmadan bir savaşa girmek veya yardım göndermekle yükümlü değildir.
- Both sides will consider sanctions against an aggressor toward the other, with scope agreed beforehand.
> Her iki taraf da, diğer tarafa saldıran bir devlete karşı, kapsamı önceden kararlaştırılmış yaptırımlar uygulamayı değerlendirecektir.

# 4. Sovereignty
> Egemenlik
- Each state recognizes the other's sovereignty and territorial integrity.
> Her iki devlet de diğerinin egemenliğini ve toprak bütünlüğünü tanır.
- Neither interferes in the other's internal politics, elections, or government formation.
> Taraflardan hiçbiri, diğerinin iç siyasetine, seçimlerine veya hükümet kurma sürecine müdahale etmez.

# 5. Consultation
> İstişare
- Each side consults the other before entering a major conflict that could directly threaten the other.
> Her taraf, diğer tarafı doğrudan tehdit edebilecek büyük bir çatışmaya girmeden önce diğer tarafla istişare eder.

# 6. Embargoes and Breach
> Ambargolar ve İhlal
- Neither side may embargo the other while this agreement is active, except after a material breach.
> İşbu anlaşma yürürlükte olduğu sürece, esaslı bir ihlal durumu dışında taraflardan hiçbiri diğerine ambargo uygulayamaz.
- A material breach is a deliberate violation of Sections 1–5 that the other party has raised in writing and that remains unresolved after 7 days.
> Esaslı ihlal, 1–5. Bölümlerin diğer tarafça yazılı olarak bildirilen ve 7 gün sonra hâlâ giderilmemiş olan kasıtlı ihlalidir.

# 7. Amendments and Disputes
> Değişiklikler ve Uyuşmazlıklar
- Changes take effect only when agreed in writing by both governments.
> Değişiklikler, ancak her iki hükümet tarafından yazılı olarak kabul edildiğinde yürürlüğe girer.
- Disputes go to direct talks between the heads of state or their delegates before any sanction, embargo, or withdrawal.
> Uyuşmazlıklar, herhangi bir yaptırım, ambargo veya anlaşmadan çekilme kararından önce devlet başkanları ya da temsilcileri arasında doğrudan görüşmelere taşınır.$b$,
    'seed/milan-aegean-federation-agreement-en-tr.pdf', 'Milan Aegean Federation Agreement EN-TR.pdf', 106859, 2,
    array['Aegean Federation'], null::date
  ),
  (
    'treaty-2-milan-xyon-agreement', 2,
    'Milan–Xyon Agreement',
    'Agreement between the Republic of Milan and the Republic of Xyon. Revision 4, a counterproposal by the Republic of Milan, 7 October 2026.',
    'Trade, priority resources and a 90-day defensive alliance with the Republic of Xyon. Xyon gives Milan first call on its oil, and Milan gives Xyon first call on T1 food. Annex A sets out the sphere of each state.',
    $b$*Changes from Revision 3: Section 2.2 and Annex B (T1 food); Annex A (Milan's sphere; wording of Xyon's entry tidied, meaning unchanged).*

The Republic of Milan and the Republic of Xyon agree as follows. The trade agreement and defensive alliance referred to in this agreement shall also be enacted through the appropriate in-game diplomatic mechanisms by each state's Foreign Minister or President.

# 1. Trade
1.1 Both states shall keep a trade agreement in force between them for as long as this agreement remains active. The trade agreement shall be renewed every 30 days in accordance with the game's trade agreement system, so that neither state charges the other import tax under the trade agreement.
1.2 Prices and quantities shall be negotiated contract by contract, based on the volume offered and the needs of both states.
1.3 Deals arranged directly between the two governments shall be priced and settled in gold unless both governments agree otherwise in writing.
1.4 Neither state shall intentionally obstruct, restrict, or interfere with trade covered by this agreement except where required by the game's mechanics, an agreed sanction, or a material breach of this agreement.

# 2. Oil and Priority Resources
2.1 Xyon shall give Milan priority access to Xyon's available oil. Milan shall be offered Xyon's available oil before it is offered to third states, subject to Xyon's available supply and mutually agreed prices and quantities.
2.2 Milan shall give Xyon priority access to T1 food. Xyon shall be offered Milan's available T1 food before it is offered to third states, subject to Milan's available supply and mutually agreed prices and quantities.
2.3 Priority access does not require either state to sell resources below a mutually agreed price, nor does it require either state to sell resources that it reasonably needs for its own domestic or governmental use.
2.4 Neither state is required to purchase a resource merely because it has priority access to it. Prices, quantities, and delivery shall be agreed upon separately for each transaction.
2.5 Neither state's priority obligation requires it to maintain a specific level of production or inventory. Priority access applies only to quantities that the relevant state actually has available for sale.

# 3. Defensive Alliance
3.1 Milan and Xyon shall enter a defensive alliance for 90 days from the date of signing and shall not declare war on each other while the alliance is active.
3.2 Seven days before the alliance expires, both governments shall consult regarding renewal. Renewal shall require written agreement from both governments and shall not occur automatically.
3.3 Either side may withdraw from the alliance with 14 days' written notice to the other government.
3.4 Withdrawal shall not remove obligations or responsibilities that arose from events occurring before the withdrawal became effective.

# 4. Mutual Defense
4.1 If a third state attacks, without provocation, a region that either Milan or Xyon holds within its sphere in Annex A, the other state shall consult with the defending state and provide reasonable assistance where possible.
4.2 Any military assistance under Section 4 shall be determined according to the size and seriousness of the conflict, the availability of players, and the ability of the assisting state to provide such assistance.
4.3 Neither state shall be automatically required to send a fixed percentage of its population or online players into a war. Any military assistance shall remain subject to the assisting state's available players and its government's approval.
4.4 An attack shall be considered unprovoked if, during the seven days before the attack, the defending state has not attacked, declared war upon, or otherwise initiated a military conflict against the attacking state.
4.5 Help under Section 4 shall be negotiated and coordinated case by case. Neither state is required to join a war that the other state started, nor to provide additional assistance beyond what its government has approved.
4.6 Neither state is automatically required to impose sanctions on an aggressor. If both governments agree to impose sanctions, the scope and duration of such sanctions shall be agreed upon by both governments beforehand.

# 5. Existing Agreements and Obligations
5.1 Nothing in this agreement requires either state to act against a state with which it already has an active agreement.
5.2 Neither state shall be required to violate an existing alliance, trade agreement, non-aggression agreement, or other binding diplomatic commitment solely because of this agreement.
5.3 If an existing agreement creates a conflict with an obligation under this agreement, the affected governments shall consult and attempt to find a mutually acceptable solution before taking action.

# 6. Sovereignty and Territory
6.1 Each state recognizes the sovereignty and territorial integrity of the other state.
6.2 Neither state shall interfere in the other's internal politics, elections, government formation, or other internal governmental affairs.
6.3 Each state's sphere is listed in Annex A. Neither state shall intentionally expand into or claim territory within the other state's listed sphere without prior consultation with the other government.
6.4 Consultation under Section 6.3 does not automatically grant permission for territorial expansion. Any expansion into another state's sphere shall require the prior agreement of the affected government.
6.5 Nothing in this section prevents either state from defending territory it already controls or responding to an attack against its territory.

# 7. Consultation
7.1 Each state shall consult the other before entering a major conflict that could directly threaten the other state or significantly affect the other's listed sphere in Annex A.
7.2 Consultation means that the governments shall make a reasonable effort to communicate their intentions, relevant circumstances, and expected consequences before taking action.
7.3 Consultation does not give either state the right to veto the other's independent foreign policy, except where this agreement explicitly requires prior consent.

# 8. Breach, Termination and Embargoes
8.1 Neither state shall intentionally impose an embargo on the other while this agreement is active, except following a material breach of this agreement or where an embargo is required by an in-game mechanic that cannot reasonably be avoided.
8.2 A breach occurs when either state deliberately fails to comply with a substantive obligation contained in this agreement.
8.3 If either state commits a breach, the other state shall provide written notice identifying the breached provision and the action required to correct it. The breaching state shall have seven days from receiving the notice to correct the breach, unless the breach cannot reasonably be corrected.
8.4 If a breach is deliberate and remains unresolved after the seven-day period, the non-breaching state may terminate this entire agreement by written notice. Termination shall end all continuing obligations under this agreement, including the trade commitments, priority-resource commitments, defensive alliance, and territorial commitments.
8.5 If a breach is severe enough to directly threaten the sovereignty, territorial integrity, or security of the other state, the non-breaching state may terminate this entire agreement immediately by written notice, without waiting seven days.
8.6 A minor, accidental, technical, or immediately corrected mistake shall not by itself constitute grounds for terminating this agreement.
8.7 Neither state may intentionally create, provoke, or manufacture a breach by the other state for the purpose of terminating this agreement.
8.8 Either state may voluntarily deactivate and withdraw from this agreement at any time by providing the other state with written notice.
8.9 Voluntary deactivation shall take effect 14 days after the written notice is received by the other state.
8.10 A voluntary deactivation shall not take effect while the withdrawing state is actively receiving mutual defense assistance under Section 4 due to an unprovoked attack that occurred before the withdrawal notice was given. In such a case, the withdrawal shall take effect 14 days after the relevant defensive conflict has ended, unless both governments agree in writing to an earlier date.
8.11 A state may not intentionally start a conflict, provoke an attack, or otherwise manufacture a defensive conflict for the purpose of preventing or delaying the deactivation of this agreement.
8.12 A state that has itself initiated the conflict or deliberately provoked the conflict shall not be considered to be receiving the protection described in Section 8.10.
8.13 During the 14-day withdrawal period, both states remain bound by all obligations of this agreement.
8.14 Termination or deactivation of this agreement shall not invalidate transactions that were already completed, nor shall it remove obligations or responsibilities that arose from events occurring before termination or deactivation became effective.
8.15 After termination or deactivation becomes effective, neither state shall have any continuing obligation under this agreement unless that obligation arose before the effective date or the governments separately agree otherwise in writing.

# 9. Amendments and Disputes
9.1 Changes to this agreement, including its annexes, shall take effect only when both governments agree to them in writing.
9.2 Any dispute concerning the interpretation or implementation of this agreement shall first be discussed directly between the heads of state, Foreign Ministers, or their designated representatives.
9.3 Neither state shall impose sanctions, embargoes, or withdraw from this agreement solely because of a dispute before the consultation process in Section 9.2 has been attempted, unless immediate action is necessary due to a material breach or to protect the state's sovereignty or security.
9.4 If a disagreement concerns the meaning of a provision, both governments shall interpret the provision according to its ordinary meaning and the purpose of maintaining peaceful and mutually beneficial relations between Milan and Xyon.

## Annex A: Spheres
| State | Sphere |
| Milan | All 12 Italian regions, including Sicily (Palermo, Catania) and Sardinia (Cagliari); Vatican City; San Marino; Malta; France; Slovenia; Croatia; Bosnia and Herzegovina; Montenegro; Albania |
| Xyon | The whole of Africa. If Xyon is not founded in Africa, this entry will be discussed again. |
| Shared or disputed | None |

## Annex B: Priority Resources
| From | To | Priority resource |
| Xyon | Milan | Oil |
| Milan | Xyon | T1 food |

## Signatures
**For the Republic of Milan**
President ______
Minister of Foreign Affairs ______
Date ______

**For the Republic of Xyon**
President ______
Minister of Foreign Affairs ______
Date ______$b$,
    'seed/milan-xyon-agreement-rev4.pdf', 'Milan_Xyon_Agreement_Rev4.pdf', 113883, 5,
    array['Republic of Xyon'], '2026-10-07'::date
  ),
  (
    'treaty-3-milan-gds-trade-treaty', 3,
    'Milan–GDS Trade Treaty',
    'Treaty between the Republic of Milan and GDS (Delaware), 7 October 2026.',
    'A trade-only treaty with GDS (Delaware). Both sides keep a tax-free trade agreement in force, renewed every 30 days. It creates no alliance and no duty of defence.',
    $b$The Republic of Milan and GDS (Delaware) agree to maintain a mutually beneficial trade relationship under the terms below.

This treaty concerns trade only and does not create any military alliance, defense obligation, territorial sphere, or requirement to exchange or prioritize any particular commodity.

# 1. Tax-Free Trade
1.1 Both parties shall maintain a trade agreement between them for as long as this treaty remains active. The agreement shall be renewed every 30 days in accordance with the game's trade agreement system.
1.2 Imports and exports conducted under the trade agreement shall be tax-free between the two parties, meaning neither party shall charge the other import tax on qualifying trade conducted under the agreement.
1.3 Prices, quantities, timing, and other commercial terms shall be negotiated freely between the parties on a transaction-by-transaction basis.
1.4 Neither party shall intentionally obstruct, restrict, or interfere with legitimate trade between the parties, except where required by the game's mechanics or following a material breach of this treaty.

# 2. Trade Restrictions and Embargoes
2.1 Neither party shall intentionally impose a trade embargo on the other while this treaty is active, except following a material breach of this treaty or where an embargo is required by an in-game mechanic that cannot reasonably be avoided.
2.2 Neither party shall intentionally create, provoke, or manufacture a breach by the other party for the purpose of terminating this treaty.
2.3 A minor, accidental, technical, or immediately corrected mistake shall not by itself constitute grounds for terminating this treaty.

# 3. Termination and Deactivation
3.1 A breach occurs when either party deliberately fails to comply with a substantive obligation contained in this treaty.
3.2 If either party commits a breach, the other party shall provide written notice identifying the breached provision and the action required to correct it. The breaching party shall have seven days from receiving the notice to correct the breach, unless the breach cannot reasonably be corrected.
3.3 If a deliberate breach remains unresolved after the seven-day period, the non-breaching party may terminate this treaty by written notice. Termination shall end all continuing obligations under this treaty.
3.4 Either party may voluntarily deactivate and withdraw from this treaty at any time by providing the other party with written notice.
3.5 Voluntary deactivation shall take effect 14 days after the written notice is received by the other party.
3.6 Termination or deactivation shall not invalidate transactions already completed, nor shall it remove obligations or responsibilities that arose before termination or deactivation became effective.
3.7 After termination or deactivation becomes effective, neither party shall have any continuing obligation under this treaty unless that obligation arose before the effective date or the parties separately agree otherwise in writing.

# 4. Amendments and Disputes
4.1 Changes to this treaty shall take effect only when both parties agree to them in writing.
4.2 Any dispute concerning the interpretation or implementation of this treaty shall first be discussed directly between the heads of state, Foreign Ministers, or their designated representatives.
4.3 Neither party shall impose sanctions, embargoes, or withdraw from this treaty solely because of a dispute before the consultation process in Section 4.2 has been attempted, unless immediate action is necessary due to a material breach.
4.4 If a disagreement concerns the meaning of a provision, both parties shall interpret the provision according to its ordinary meaning and the purpose of maintaining peaceful and mutually beneficial trade relations between Milan and GDS.

## Signatures
**For the Republic of Milan**
President ______
Minister of Foreign Affairs ______
Date ______

**For GDS (Delaware)**
President ______
Minister of Foreign Affairs ______
Date ______$b$,
    'seed/milan-gds-trade-treaty.pdf', 'Milan_GDS_Trade_Treaty.pdf', 77461, 2,
    array['GDS (Delaware)'], '2026-10-07'::date
  )
  ) as v(slug, number, title, subtitle, summary, body, pdf_path, pdf_name, pdf_size, pdf_pages, parties, introduced_on)
  returning id, slug, introduced_on
)
insert into public.act_events (act_id, happened_on, label, detail, member_name)
select ins.id, e.d, e.label, e.detail, null
from ins
join (values
  ('treaty-2-milan-xyon-agreement', '2026-10-07'::date, 'Revision 4 issued', 'Counterproposal by the Republic of Milan.'),
  ('treaty-3-milan-gds-trade-treaty', '2026-10-07'::date, 'Treaty text dated', null),
  ('treaty-1-milan-aegean-federation-agreement', '2026-10-16'::date, 'Passed by Parliament', 'Recorded when the register opened. Date of the vote not yet entered.'),
  ('treaty-2-milan-xyon-agreement', '2026-10-16'::date, 'Passed by Parliament', 'Recorded when the register opened. Date of the vote not yet entered.'),
  ('treaty-3-milan-gds-trade-treaty', '2026-10-16'::date, 'Passed by Parliament', 'Recorded when the register opened. Date of the vote not yet entered.')
) as e(slug, d, label, detail) on e.slug = ins.slug;
