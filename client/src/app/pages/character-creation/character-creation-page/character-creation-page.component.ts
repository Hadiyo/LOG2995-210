import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import {
  generateCharacterFormValues,
  makeFullName,
  normalizeCharacterName,
  sanitizeCharacterName,
  validatePlayerName,
} from '@app/services/character/character-generator';
import { SessionService } from '@app/services/session/session.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import {
  AVATAR_IDS,
  AVATAR_PROFILES,
  AvatarId,
  CHARACTER_BASE_ATTRIBUTES,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_PLUS_TWO_VALUE,
  Die,
  DIE_TARGET_ATTRIBUTE_NAMES,
  DieTargetAttributeName,
  PLUS_TWO_ATTRIBUTE_NAMES,
  PlusTwoAttributeName,
} from '@common/character/character.model';
import { Bonus, PlayerInformation } from '@common/player/player.interface';
import { map, startWith, Subscription } from 'rxjs';

// Explicit type to widen the literal "attaque" to the full union ("attaque" | "defense"),
// otherwise TS thinks comparisons to "defense" are impossible.
const DEFAULT_PLUS_TWO: PlusTwoAttributeName = PLUS_TWO_ATTRIBUTE_NAMES[0];
const DEFAULT_D6_TARGET: DieTargetAttributeName = DIE_TARGET_ATTRIBUTE_NAMES[0];

// Base attributes that every character starts with before applying bonuses
type BaseAttrKey = keyof typeof CHARACTER_BASE_ATTRIBUTES;

@Component({
  selector: 'app-character-creation-page',
  imports: [CommonModule, ReactiveFormsModule, BackButtonComponent, AsyncPipe, RouterModule],
  templateUrl: './character-creation-page.component.html',
  styleUrls: ['./character-creation-page.component.scss'],
})
export class CharacterCreationPageComponent implements OnInit, OnDestroy {
  readonly avatars = AVATAR_IDS;
  readonly nameMaxLength = CHARACTER_NAME_MAX_LENGTH;

  protected isLocked$ = this.waitingRoomService.isLocked$;
  protected readonly takenAvatars$ = this.waitingRoomService.players$.pipe(
    map(players => players.map(p => p.avatarId)),
  );

  private contextSub!: Subscription;
  private context: 'create' | 'join';
  
  constructor(private readonly fb: FormBuilder,
    private sessionService: SessionService,
    private waitingRoomService: WaitingRoomService) {}

  get errorMessage(): string {
    return this.sessionService.errorMessage();
  }

  ngOnInit() {
    this.sessionService.initGameSessionService();
    this.waitingRoomService.initWaitingRoom();
    // To know whether the client comes from join-room page or create-game page
    this.contextSub = this.sessionService.context$.subscribe(ctx => {
      if (ctx) this.context = ctx;
    });
  }


  ngOnDestroy(): void {
    this.contextSub.unsubscribe();
    this.sessionService.unsubscribeToSessionEvents();
  }

  // Form group for character creation, with validation rules
  readonly form = this.fb.group({
    name: ['', [
      Validators.required,
      Validators.maxLength(CHARACTER_NAME_MAX_LENGTH),
      // Allow letters, spaces, apostrophes, and hyphens (including accented characters)
      Validators.pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ0-9'’ -]+$/),
    ]],
    avatarId: [null as AvatarId | null, Validators.required],
    plusTwo: [DEFAULT_PLUS_TWO as PlusTwoAttributeName, Validators.required],
    d6GoesTo: [DEFAULT_D6_TARGET as DieTargetAttributeName, Validators.required],
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
    const snapshot: AvatarId[] = this.waitingRoomService.getPlayerSnapshot().map(player => player.avatarId);
    const availableAvatars = AVATAR_IDS.filter(avatar => !snapshot.includes(avatar));
    const takenNames: string[] = this.waitingRoomService.getPlayerSnapshot().map(player => player.name);
    const generated = generateCharacterFormValues(takenNames, availableAvatars);
    this.form.patchValue(generated);
  }

  // Handler for the "Nom aléatoire" button, generates a random name and updates the form control
  onRandomName(): void {
    const takenNames: string[] = this.waitingRoomService.getPlayerSnapshot().map(player => player.name);
    this.form.controls.name.setValue(makeFullName(takenNames));
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
    // Validate the name
    const name = this.validateName(this.form.controls.name.value);

    let character: PlayerInformation;
    if (this.context === 'create') {
      character = this.buildCharacterFromForm(true, name);
      this.sessionService.createGameSession(character);
    } else {
      character = this.buildCharacterFromForm(false, name);
      this.sessionService.addPlayerToSession(character);
    }
  }

  onLeavingCharacterCreation(): void {
    this.sessionService.leaveSession();
  }

  protected getAvatarThumbPath(avatarId: number): string {
    return resolveAssetUrl(`assets/avatars/thumbs/${avatarId}.png`);
  }

    // Build a Character object from the current form values, applying necessary transformations
  private buildCharacterFromForm(isAnOrganizer: boolean, name: string): PlayerInformation {
    const PLUS_TWO_TO_BONUS: Record<PlusTwoAttributeName, Bonus> = {
      vie: 'life',
      rapidite: 'speed',
    };
    const { avatarId, plusTwo, d6GoesTo } = this.form.getRawValue();

    if (!name || avatarId === null || !plusTwo || !d6GoesTo) {
      throw new Error('Form invalid: missing required fields');
    }
    const attaqueDie: Die = d6GoesTo === 'attaque' ? 'D6' : 'D4';
    const defenseDie: Die = d6GoesTo === 'defense' ? 'D6' : 'D4';

    return {
      name: normalizeCharacterName(name),
      avatarId,
      isOrganizer: isAnOrganizer,
      dices: {
        attack: attaqueDie,
        defense: defenseDie,
      },
      bonus: PLUS_TWO_TO_BONUS[plusTwo],
    };
  }

  private validateName(name: string | null): string {
    const takenNames: string[] = this.waitingRoomService.getPlayerSnapshot().map(player => player.name);
    if(!name) {
      name = makeFullName(takenNames);
      return validatePlayerName(name, takenNames);
    }
    return validatePlayerName(name, takenNames);
  }

}
