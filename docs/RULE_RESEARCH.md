# Rule Research

## Verified WT Recognized Poomsae Baseline

WT Poomsae Competition Rules & Interpretation, in force as of June 14, 2024, defines recognized poomsae scoring as 10.0 total points:

- Accuracy: 4.0.
- Presentation: 6.0.
- Presentation components: speed and power, rhythm and tempo, expression of energy.
- Small accuracy mistake: deduct 0.1.
- Big accuracy mistake: deduct 0.3.
- Accuracy and presentation are scored separately.
- Final score excludes the highest and lowest scores in the respective accuracy/technical and presentation point groups, then averages.
- Early/late finish and boundary crossing deduct 0.3 from final score.

This project stores these values as integer tenths: 4.0 is `40`, 0.1 is `1`, and 0.3 is `3`.

## Verified USATKD 2026 Profile

The 2026 USATKD Poomsae Rules are effective January 1, 2026 and apply to USATKD promoted, organized, or sanctioned events. They explicitly support three-judge and five-judge formats by event ranking. USATKD allows event-specific changes only with written approval, but essential matters such as scoring must not be changed.

The first software profile mirrors recognized poomsae scoring values from the official USATKD document and keeps organization/jurisdiction separate from WT.

## Taiwan Findings

The Chinese Taipei Taekwondo Association site provides a rules index and a bilingual WT 2024 poomsae PDF. A 2026 national poomsae championship outline says it uses the latest WT poomsae competition rules, draws two poomsae, and resolves ties by higher presentation score, then total including dropped highest/lowest scores, then a referee-designated rematch poomsae.

Because this is an event outline rather than a full scoring rulebook, this project does not create a Taiwan Rule Profile yet. Taiwan-specific settings remain `pending_verification`.
