import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { Character } from '@common/character/character.interface';
import {
  AVATAR_IDS,
  CHARACTER_BASE_ATTRIBUTES,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_PLUS_TWO_VALUE,
  PLUS_TWO_ATTRIBUTE_NAMES,
  DIE_TARGET_ATTRIBUTE_NAMES,
  Die,
  AvatarId,
  AVATAR_PROFILES,
  PlusTwoAttributeName,
  DieTargetAttributeName,
} from '@common/character/character.model';
import {
  generateCharacterFormValues,
  sanitizeCharacterName,
  normalizeCharacterName,
} from '@app/services/character/character-generator';

// Explicit type to widen the literal "attaque" to the full union ("attaque" | "defense"),
// otherwise TS thinks comparisons to "defense" are impossible.
const DEFAULT_PLUS_TWO: PlusTwoAttributeName = PLUS_TWO_ATTRIBUTE_NAMES[0];
const DEFAULT_D6_TARGET: DieTargetAttributeName = DIE_TARGET_ATTRIBUTE_NAMES[0];

// Base attributes that every character starts with before applying bonuses
type BaseAttrKey = keyof typeof CHARACTER_BASE_ATTRIBUTES;

@Component({
  selector: 'app-character-creation-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './character-creation-page.component.html',
  styleUrls: ['./character-creation-page.component.scss'],
})
export class CharacterCreationPageComponent {
  readonly avatars = AVATAR_IDS;
  readonly nameMaxLength = CHARACTER_NAME_MAX_LENGTH;
  constructor(private readonly fb: FormBuilder) { }

  // Form group for character creation, with validation rules
  readonly form = this.fb.group({
    name: ['', [
      Validators.required,
      Validators.maxLength(CHARACTER_NAME_MAX_LENGTH),
      // Allow letters, spaces, apostrophes, and hyphens (including accented characters)
      Validators.pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ'’ -]+$/),
    ]],
    avatarId: [null as AvatarId | null, Validators.required],
    plusTwo: [DEFAULT_PLUS_TWO, Validators.required],
    d6GoesTo: [DEFAULT_D6_TARGET, Validators.required],
  });

  // Precompute avatar fallback colors from CSS variables for use in the template
  readonly avatarFallbackColors = Array.from({ length: 12 }, (_, i) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--avatar-${i}`).trim(),
  );

  // Convert form control observables value changes into signals 
  // because computed() can't directly subscribe to observables
  private readonly avatarIdValue = toSignal(
    this.form.controls.avatarId.valueChanges.pipe(
      startWith(this.form.controls.avatarId.value),
    ),
    { initialValue: this.form.controls.avatarId.value },
  );

  // Compute the selected avatar profile based on the current avatarId form value
  readonly selectedAvatarProfile = computed(() => {
    const id = this.avatarIdValue();
    return id === null ? null : AVATAR_PROFILES[id];
  });

  // Compute the preview stats based on the current plusTwo and d6GoesTo form values
  readonly previewStats = computed(() => {
    const plusTwo = this.plusTwoValue() as BaseAttrKey;
    const d6Target = this.d6TargetValue() as BaseAttrKey;
    return {
      ...CHARACTER_BASE_ATTRIBUTES,
      [plusTwo]: CHARACTER_BASE_ATTRIBUTES[plusTwo] + CHARACTER_PLUS_TWO_VALUE,
      attaque: `${CHARACTER_BASE_ATTRIBUTES.attaque} + ${d6Target === 'attaque' ? 'D6' : 'D4'}`,
      defense: `${CHARACTER_BASE_ATTRIBUTES.defense} + ${d6Target === 'defense' ? 'D6' : 'D4'}`,
    };
  });

  // Convert form controls for plusTwo and d6GoesTo into signals to use in computed properties
  private readonly plusTwoValue = toSignal(
    this.form.controls.plusTwo.valueChanges.pipe(startWith(this.form.controls.plusTwo.value ?? DEFAULT_PLUS_TWO)),
    { initialValue: DEFAULT_PLUS_TWO },
  );
  private readonly d6TargetValue = toSignal(
    this.form.controls.d6GoesTo.valueChanges.pipe(startWith(this.form.controls.d6GoesTo.value ?? DEFAULT_D6_TARGET)),
    { initialValue: DEFAULT_D6_TARGET },
  );

  // Handler for when an avatar is selected, updates the form control value
  onSelectAvatar(id: AvatarId): void {
    this.form.controls.avatarId.setValue(id);
  }

  // Handler for the "Générer personnage" button, fills the form with random values
  onGenerate(): void {
    const generated = generateCharacterFormValues();
    this.form.patchValue(generated);
  }

  // Handler for the "Nom aléatoire" button, generates a random name and updates the form control
  onRandomName(): void {
    const generated = generateCharacterFormValues();
    this.form.controls.name.setValue(generated.name);
  }

  // Build a Character object from the current form values, applying necessary transformations
  private buildCharacterFromForm(): Character {
    const { name, avatarId, plusTwo, d6GoesTo } = this.form.getRawValue();

    if (!name || avatarId === null || !plusTwo || !d6GoesTo) {
      throw new Error('Form invalid: missing required fields');
    }
    const attaqueDie: Die = d6GoesTo === 'attaque' ? 'D6' : 'D4';
    const defenseDie: Die = d6GoesTo === 'defense' ? 'D6' : 'D4';

    return {
      name: normalizeCharacterName(name),
      avatarId,
      bonuses: {
        plusTwo,
        attaqueDie,
        defenseDie,
      },
    };
  }

  // Handler for name input changes, 
  // sanitizes the input and updates the form control without emitting another event to avoid loops
  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = sanitizeCharacterName(input.value);

    if (cleaned !== input.value) {
      input.value = cleaned;
      this.form.controls.name.setValue(cleaned, { emitEvent: false });
    }
  }

  // Handler for form submission, 
  // validates the form and builds the character object
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const character = this.buildCharacterFromForm();
    // TODO: send to service to save the character, need to implement character service and backend endpoint first
    alert(`Character created successfully!\n\n${JSON.stringify(character, null, 2)}`);
  }

}
