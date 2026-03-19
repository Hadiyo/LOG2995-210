import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import {
  generateCharacterFormValues,
  makeFullName,
  normalizeCharacterName,
  sanitizeCharacterName,
  validatePlayerName,
} from '@app/services/character/character-generator';
import { MatchStateService } from '@app/services/match/match-state.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { Character } from '@common/character/character.interface';
import {
  AVATAR_IDS,
  AVATAR_PROFILES,
  AvatarId,
  CHARACTER_BASE_ATTRIBUTES,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_PLUS_TWO_VALUE,
  DIE_TARGET_ATTRIBUTE_NAMES,
  Die,
  DieTargetAttributeName,
  PLUS_TWO_ATTRIBUTE_NAMES,
  PlusTwoAttributeName,
} from '@common/character/character.model';
import { map, startWith } from 'rxjs';

const DEFAULT_PLUS_TWO: PlusTwoAttributeName = PLUS_TWO_ATTRIBUTE_NAMES[0];
const DEFAULT_D6_TARGET: DieTargetAttributeName = DIE_TARGET_ATTRIBUTE_NAMES[0];
type BaseAttrKey = keyof typeof CHARACTER_BASE_ATTRIBUTES;

@Component({
  selector: 'app-character-creation-page',
  imports: [CommonModule, ReactiveFormsModule, BackButtonComponent, AsyncPipe, RouterModule],
  templateUrl: './character-creation-page.component.html',
  styleUrls: ['./character-creation-page.component.scss'],
})
export class CharacterCreationPageComponent {
  readonly avatars = AVATAR_IDS;
  readonly nameMaxLength = CHARACTER_NAME_MAX_LENGTH;

  protected readonly isLocked$ = this.waitingRoomService.isLocked$;
  protected readonly takenAvatars$ = this.waitingRoomService.players$.pipe(
    map((players) => players.map((player) => player.avatarId)),
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly matchStateService: MatchStateService,
    private readonly waitingRoomService: WaitingRoomService,
  ) {}

  get errorMessage(): string {
    return this.matchStateService.errorMessage();
  }

  readonly form = this.fb.group({
    name: ['', [
      Validators.required,
      Validators.maxLength(CHARACTER_NAME_MAX_LENGTH),
      Validators.pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ0-9'’ -]+$/),
    ]],
    avatarId: [null as AvatarId | null, Validators.required],
    plusTwo: [DEFAULT_PLUS_TWO as PlusTwoAttributeName, Validators.required],
    d6GoesTo: [DEFAULT_D6_TARGET as DieTargetAttributeName, Validators.required],
  });

  readonly avatarFallbackColors = Array.from({ length: 12 }, (_, i) =>
    getComputedStyle(document.documentElement).getPropertyValue(`--avatar-${i}`).trim(),
  );

  private readonly avatarIdValue = toSignal(
    this.form.controls.avatarId.valueChanges.pipe(startWith(this.form.controls.avatarId.value)),
    { initialValue: this.form.controls.avatarId.value },
  );

  readonly selectedAvatarProfile = computed(() => {
    const id = this.avatarIdValue();
    return id === null ? null : AVATAR_PROFILES[id];
  });

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

  private readonly plusTwoValue = toSignal(
    this.form.controls.plusTwo.valueChanges.pipe(startWith(this.form.controls.plusTwo.value ?? DEFAULT_PLUS_TWO)),
    { initialValue: DEFAULT_PLUS_TWO },
  );

  private readonly d6TargetValue = toSignal(
    this.form.controls.d6GoesTo.valueChanges.pipe(startWith(this.form.controls.d6GoesTo.value ?? DEFAULT_D6_TARGET)),
    { initialValue: DEFAULT_D6_TARGET },
  );

  onSelectAvatar(id: AvatarId): void {
    this.form.controls.avatarId.setValue(id);
  }

  onGenerate(): void {
    const players = this.waitingRoomService.getPlayerSnapshot();
    const availableAvatars = AVATAR_IDS.filter((avatar) => !players.some((player) => player.avatarId === avatar));
    const takenNames = players.map((player) => player.name);
    const generated = generateCharacterFormValues(takenNames, availableAvatars.length > 0 ? availableAvatars : [...AVATAR_IDS]);
    this.form.patchValue(generated);
  }

  onRandomName(): void {
    const takenNames = this.waitingRoomService.getPlayerSnapshot().map((player) => player.name);
    this.form.controls.name.setValue(makeFullName(takenNames));
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = sanitizeCharacterName(input.value);

    if (cleaned !== input.value) {
      input.value = cleaned;
      this.form.controls.name.setValue(cleaned, { emitEvent: false });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.validateName(this.form.controls.name.value);
    const character = this.buildCharacterFromForm(name);

    this.matchStateService.registerLocalPlayer(character);
    const localPlayer = this.matchStateService.localPlayer();
    if (!localPlayer) {
      this.matchStateService.errorMessage.set('Impossible de preparer la salle d attente.');
      return;
    }

    const accessCode = this.route.snapshot.queryParamMap.get('accessCode');
    if (accessCode) {
      this.waitingRoomService.initAsPlayer(accessCode, localPlayer);
    } else {
      const selectedMap = this.matchStateService.selectedMap();
      if (!selectedMap) {
        this.matchStateService.errorMessage.set('Impossible de preparer la salle d attente.');
        return;
      }
      this.waitingRoomService.initAsOrganizer(selectedMap.id, localPlayer);
    }

    void this.router.navigate(['/waiting-room'], {
      queryParams: accessCode ? { accessCode } : undefined,
    });
  }

  onLeavingCharacterCreation(): void {
    void this.router.navigate(['/home']);
  }

  protected getAvatarThumbPath(avatarId: number): string {
    return resolveAssetUrl(`assets/avatars/thumbs/${avatarId}.png`);
  }

  private buildCharacterFromForm(name: string): Character {
    const { avatarId, plusTwo, d6GoesTo } = this.form.getRawValue();

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

  private validateName(name: string | null): string {
    const takenNames = this.waitingRoomService.getPlayerSnapshot().map((player) => player.name);
    if (!name) {
      return validatePlayerName(makeFullName(takenNames), takenNames);
    }
    return validatePlayerName(name, takenNames);
  }
}
