# What the payload saving actually is

A ViewSpec is smaller than the equivalent markup, but by about **half**, not by an order
of magnitude — measured across the exemplar corpus as minified JSON against the static
HTML the renderer emits for the same view. Per-document it ranges from roughly a quarter
to just under two thirds. Tokens and bytes agree to within a percentage point, so the
result is a property of the payload rather than of a particular tokenizer.

**The saving comes from repetition, and only from repetition.** A document that repeats a
shape — rows, cards, a directory — states that shape once under `$each` where markup
repeats it per item, and those documents sit at the top of the range. A document of
one-off fields has nothing to collapse and sits at the bottom, while simultaneously
carrying form validation and metadata that have no counterpart in the markup at all. So
the honest claim is "about half, widening with repetition", never a flat headline figure.

**Two traps when measuring this.**

Pretty-printed JSON against unformatted HTML is not a comparison. Indentation costs
roughly three tokens per line — around a 48% surcharge — mostly not from the indent runs
themselves but from breaking apart punctuation that would otherwise merge into single
tokens. Compare minified against minified, and check the markup side really is free of
strippable whitespace rather than assuming it.

Static markup omits interactivity, so it flatters itself. A rendered snapshot carries no
validation, no handlers and nothing that is closed by default, so an actually-equivalent
payload is larger than what gets counted. The measured figure is therefore a floor, and
should be described as being against static markup alone. Resist the urge to guess how
much the missing script would add.
