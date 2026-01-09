En tant que participant dans une partie, je dois avoir accès à un journal de jeu avec des informations sur la partie. Je dois pouvoir consulter ce journal dans un onglet dédié dans la zone des messages dans la partie et la vue de fin de partie.

## Zone des messages

Je dois voir une zone des messages partagée entre le clavardage du jeu et le journal de jeu. Je ne dois pas avoir accès au journal de jeu avant le début de la partie. Je dois pouvoir alterner entre les deux onglets en tout temps dans la partie et la vue de fin de partie. Je dois recevoir des messages dans un onglet, même si ce n'est pas l'onglet actif au moment de la réception des messages. Un message dans le journal est considéré comme une _entrée de journal_ .

## Entrées de journal

Je dois voir chaque entrée de journal horodatée avec l'entrée la plus récente en bas de la liste. Je dois voir le ou les joueurs impliqués dans une entrée d'événement. Je dois voir les entrées d'événement de combat seulement si je suis impliqué dans le combat.

**Critères d'acceptabilité**

- [ ] Le système doit présenter un journal de jeu initialement vide dans la zone des messages dès le début d'une partie.
  - [ ] Le système permet de changer entre les messages de clavardage et le journal de jeu.
  - [ ] Le système génère des messages même si le journal n'est pas l'onglet actif.
- [ ] Les entrées de journal sont horodatées selon le format `HH:MM:SS` et affichées dans une liste.
  - [ ] L'entrée la plus récente est affichée en bas de la liste.
  - [ ] Les entrées affichent le nom des joueurs impliqués dans l'événement ayant généré le message.
<hr>

- [ ] Le système présente les messages globaux suivants à tous:
  - [ ] Début de tour, début de combat, fin et résultat du combat
  - [ ] Ouverture ou fermeture d'une porte
  - [ ] Utilisation d'un sanctuaire
  - [ ] Activation ou désactivation du mode de débogage
  - [ ] Abandon de partie
  - [ ] (En mode _CTF_) Transfert de drapeau
  - [ ] Fin de partie (affichage des noms des joueurs encore actifs seulement)
- [ ] Le système présente les messages de combats suivants aux joueurs impliqués seulement (pour chaque joueur) :
  - [ ] Calcul détaillé pour _attaque_ : valeur de base, bonus de posture, résultat de dé, malus (si applicable), total
  - [ ] Calcul détaillé pour _défense_ : valeur de base, bonus de posture, résultat de dé, malus (si applicable), total
  - [ ] Différence entre l'attaque du joueur 1 et la défense du joueur 2 et vice-versa
  - [ ] Résultat de l'attaque (dégâts ou non)