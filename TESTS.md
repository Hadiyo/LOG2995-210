# Validation logicielle et tests unitaires

Les projets fournis sont accompagnés de tests unitaires et une configuration de base pour leur exécution.

Dans le cadre du projet, vous devez modifier les fichiers de tests unitaires associés à vos ajouts ou modifications de code. À chaque Sprint, une fonctionnalité sera ciblée et vous devrez vous assurer que le code associé à cette fonctionnalité est couvert par des tests unitaires adéquats. En fonction de la fonctionnalité et votre implémentation, plusieurs classes et fichiers de tests unitaires peuvent être concernés.

Cette documentation décrit comment lancer les tests, le calcul de couverture de code et les configurations nécessaires pour cibler seulement certaines parties du code. Chaque projet utilise un outil différent pour les tests unitaires et la couverture de code. Les sections suivantes décrivent les particularités de chaque projet.

Lors d'une remise, vous devez vous assurer que tous les tests unitaires passent et que la configuration de couverture de code est adéquate pour la fonctionnalité implémentée dans les 2 projets (client et serveur).

## Lancement des tests

Peu importe le projet (client ou serveur), les tests unitaires peuvent être lancés en utilisant la commande suivante à la racine du projet :

```bash
npm test
```

Cette commande exécutera tous les tests unitaires définis dans le projet. Consultez le fichier `package.json` pour plus de détails sur les scripts disponibles.

Par défaut, tout le code de départ fourni est testé. Cependant, pour les besoins du projet, vous devez retirer ou modifier certains tests unitaires.

## Calcul de la couverture de code

Pour calculer la couverture de code lors de l'exécution des tests unitaires, vous pouvez utiliser la commande suivante :

```bash
npm run coverage
```

Cette commande génère un rapport de couverture de code qui indique quelles parties du code sont couvertes par les tests unitaires. Le rapport est généré dans un répertoire spécifique `coverage`.

Ce rapport prend la forme d'un site web que vous pouvez ouvrir dans votre navigateur pour visualiser la couverture de code de manière détaillée : 
- Une ligne en rouge indique une partie du code qui n'est pas couverte par les tests unitaires.
- Une ligne en vert indique une partie du code qui a été couverte par au moins 1 test. Le chiffre à côté de la ligne indique le nombre de fois que cette ligne a été exécutée lors des tests.
- Une ligne en jaune indique une couverture partielle. Souvent cela signifie qu'une condition dans une instruction `if` n'a pas été testée dans les deux branches (incluant les branches implicites).

Par défaut, tout le code de départ fourni est couvert par le calcul de couverture. Cependant, pour les besoins du projet, certaines parties du code sont exclues de ce calcul. Cela permet de se concentrer sur la couverture des parties du code que vous modifiez ou ajoutez.

### Configuration du projet Angular

Dans le cas d'un projet Angular utilisant Karma et Jasmine, la configuration de la couverture de code se trouve dans le fichier `angular.json`. Par défaut, tout le code est inclus dans le calcul de couverture.

Vous devez spécifier les fichiers ou répertoires à exclure du calcul de couverture en modifiant la section `codeCoverageExclude` dans la configuration de l'application.

Pour spécifier un fichier ou un répertoire à **ne pas** exclure, vous devez utiliser le préfixe `!` avant le chemin. Par exemple, pour inclure seulement les fichiers dans `src/app/components/`, vous ajouteriez la ligne suivante :

```json
"!(src/app/components/**/*.ts)"
```

Vous pouvez inclure un fichier de manière explicite : 

```json
"!(src/app/components/play-area/play-area.component.ts)"
```

Notez que dans ce cas, tous les fichiers de tests seront quand même exécutés, même si certains fichiers sont exclus du calcul de couverture. Il est conseillé de retirer les fichiers `.spec.ts` vides (générés par défaut) pour éviter toute confusion.

## Configuration du projet serveur (Node + Express)

Dans le cas d'un projet serveur utilisant Mocha et Chai, la configuration de la couverture de code se trouve dans le fichier `package.json`. Par défaut, tout le code est inclus dans le calcul de couverture.

Vous devez spécifier les fichiers ou répertoires à inclure dans le calcul de couverture en modifiant la section `nyc` dans le fichier `package.json`. Vous devez ajuster la section `include` pour cibler uniquement les fichiers que vous souhaitez inclure dans le calcul de couverture. Par exemple, pour inclure seulement les fichiers dans `app/services/`, vous modifieriez la section comme suit :

```json
"include": [
    "app/services/*.ts"
],
```

Vous pouvez inclure des fichiers de manière explicite : 

```json
"include": [
    "app/controllers/date.controller.ts",
    "app/services/date.service.ts"
],
```

Notez que dans ce cas, tous les fichiers de tests seront quand même exécutés, même si certains fichiers sont exclus du calcul de couverture. Il est conseillé de retirer les fichiers `.spec.ts` vides (générés par défaut) pour éviter toute confusion.

## Configuration du projet serveur (NestJS)

Dans le cas d'un projet serveur utilisant NestJS, la configuration de la couverture de code se trouve également dans le fichier `package.json`. Par défaut, tout le code est inclus dans le calcul de couverture.

Vous devez spécifier les fichiers ou répertoires à inclure dans le calcul de couverture en modifiant la section `collectCoverageFrom` de l'outil `Jest` dans le fichier `package.json`. Il est conseillé de garder les 2 dernières lignes qui excluent certains fichiers spécifiques déjà fournis.

Par exemple, pour inclure seulement les fichiers dans `/gateways`, vous modifieriez la section comme suit :

```json
"collectCoverageFrom": [
    "app/gateways/**/*.ts",
],
```

Vous pouvez inclure des fichiers de manière explicite : 

```json
"collectCoverageFrom": [
    "app/controllers/course/course.controller.ts",
    "app/services/course/course.service.ts",
],
```

Notez que dans ce cas, tous les fichiers de tests seront quand même exécutés, même si certains fichiers sont exclus du calcul de couverture. Il est conseillé de retirer les fichiers `.spec.ts` vides (générés par défaut) pour éviter toute confusion.

### Configuration de seuils minimaux de couverture

Par défaut, il n'y a pas de seuil minimal de couverture configuré. Cependant, vous pouvez définir des seuils minimaux globaux ou par fichier dans chacun des projets. L'exécution de la commande de couverture échouera si les seuils minimaux ne sont pas atteints. Ceci est de votre choix, mais peut vous aider à maintenir une bonne couverture de code au fil du temps.

Les configurations sont les suivantes : 

#### Seuils pour le projet Angular

Ajouter l'objet `check` dans la section `coverageReporter` dans le fichier `karma.conf.js` : 

```javascript
coverageReporter: {
    check: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        }
    }
}
```

#### Seuils pour le projet Node + Express

Ajouter les entrées suivantes dans l'objet `nyc` du fichier `package.json` : 

```json
"nyc":{
    "check-coverage": true,
    "statements": 80,
    "branches": 80,
    "functions": 80,
    "lines": 80,
}
```

#### Seuils pour le projet NestJS 

Ajouter une section `coverageThreshold` dans l'objet `jest` du fichier `package.json`. Ex : 

```json
"jest":{
    "coverageThreshold": {
        "global": {
            "branches": 80,
            "functions": 80,
            "lines": 80,
            "statements": 80
        }
    },
}
```