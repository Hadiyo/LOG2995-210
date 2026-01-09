# Déploiement

Le déploiement se fait à travers une étape (_stage_) manuelle de la _CI_ qui est déclenchée lorsqu'un **tag** contenant le mot clé **deploy** est rajouté sur git. Chaque tag est unique, mais vous pouvez utiliser des versions pour vos déploiements. Par exemple : **deploy_v1.0**, **deploy_v1.1**, etc.

Une fois que le tag est détecté par GitLab, un pipeline sera créé et vous verrez des options (_jobs_) pour le déploiement du client et du serveur. Ces _jobs_ doivent être cependant lancés manuellement. Pour le faire, naviguez sur le menu de pipelines disponible dans `Build > Pipelines`. Le pipeline aura le statut `Blocked`. Cliquez sur le statut et lancez la _job_ que vous souhaitez. Vous pouvez déployer seulement une des deux parties du projet ou les deux en même temps.

**Attention : le pipeline de déploiement ne fait que déployer le site web et/ou serveur. Il n'effectue pas toutes les validations de l'intégration continue. Vous devez vous assurer que votre projet est fonctionnel et de qualité acceptable avant de le déployer.**

Vous n'êtes pas obligés de garder tous les tags de déploiement. On vous conseille d'en garder 2-3 seulement.

**Astuce :** Si vous avez des difficultés ou des erreurs lors du déploiement, consultez la section [FAQ](#faq) pour les solutions aux problèmes typiques que vous pourriez rencontrer.


**Note importante**: On vous conseille de tester le déploiement le plus tôt possible. Vous pouvez le faire dès le tout début du projet. Comme cela, si des complications surviennent, les chargés pourront vous aider à les résoudre le plus tôt possible. La veille de la remise du sprint n'est généralement pas un moment propice au débogage.

# Plan et répartition des tâches pour les sprints

-   La section [Déploiement du client](#déploiement-du-client) contient toutes les informations en rapport avec le déploiement du client. Cette procédure est plus simple, mais vous aurez à refaire un changement de configuration après avoir déployé le serveur dynamique pour configurer la communication entre les deux parties

-   La section [Déploiement manuel du serveur](#déploiement-manuel-du-serveur) contient toutes les informations en rapport avec le déploiement manuel du serveur. La procédure décrite a pour but de démystifier le déploiement d'un serveur distant. Cette procédure doit être faite au complet au moins une fois par au moins un membre de l'équipe. Elle n'est pas corrigée, mais est obligatoire.

-   La section [Déploiement automatique du serveur](#déploiement-automatique-du-serveur) contient toutes les informations en rapport avec le déploiement automatique du serveur à l'aide du pipeline. Un prérequis de cette étape est d'avoir une instance en marche sur Amazon EC2. Ce déploiement doit être fonctionnel aux SPRINTS 2 et 3.

# Déploiement du client

Le site web peut être déployé sur la plateforme GitLab Pages et accessible sur une adresse fixe. GitLab Pages est un service avec un serveur statique HTTP similaire (mais pas pareil!) au serveur de déploiement local. L'URL de base n'est pas la même que votre serveur local (`/`) : faites attention aux chemins relatifs dans votre code. Des chemins de type `../../` auront un comportement différent que la version locale. Consultez cette [section](#le-déploiement-fonctionne-mais-les-images-ne-se-chargent-pas) pour plus d'informations sur la gestion des chemins relatifs dans les fichiers `HTML` et `CSS`/`SCSS`.

Les étapes pour le déploiement de la page statique se trouvent dans le fichier [.gitlab-ci.yml](.gitlab-ci.yml) sous la job _pages_. De façon très concise, cette _job_ transpile le projet Angular en JS/HTML, minifie tout le code et copie les ressources statiques dans un dossier `public`. Ensuite elle rend publique à partir de l'adresse GitLab pages associée les fichiers `html`, `css` et `js` générés.

Ce déploiement est fait à travers le système d'Intégration Continue dans GitLab. Avant de pouvoir déployer le site web, il faut configurer plusieurs éléments. Pour faire ceci, vous devez suivre les étapes suivantes :

-   Naviguez sur le menu de variables disponible dans `Settings > CI/CD > Variables` de votre projet.
-   Ajoutez une nouvelle variable avec `Add variable` dont le nom est `BASE_HREF` et la valeur suit le format `/log2995/202AB/equipe-XYZ/LOG2995-XYZ/`. Dans ce format, `A` représente le dernier chiffre de l'année actuelle, `B` indique le numéro de la session (`1` pour hiver, `3` pour automne), et `XYZ` est votre numéro d'équipe à trois chiffres. Par exemple, pour l'équipe 001 de l'automne 2026, la valeur serait `/log2995/20263/equipe-001/LOG2995-001/`.
-   Assurez-vous que la variable n'est pas protégée ou masquée (décochez les 2 flags en bas) et cliquez sur `Add variable`. La variable sera maintenant disponible lors de la phase de déploiement.
-   Ajoutez un **tag** contenant le mot clé **deploy** (ex : `deploy_v0.1`) sur la branche que vous voulez déployer pour déclencher un pipeline de déploiement. Vous pouvez ajouter le tag directement dans Gitlab (dernier commit d'une branche seulement) à travers `Code > Tags` ou par la commande `git tag deploy_v0.1` suivie de `git push origin deploy_v0.1` dans un terminal. Voir la documentation de [tags de git](https://git-scm.com/book/en/v2/Git-Basics-Tagging).
-   Naviguez sur le menu de `Pipelines` disponible dans `Build > Pipelines`. Si le tag a été ajouté correctement, vous devriez voir un pipeline manuel bloqué avec un seul _stage_ et les _jobs_ de déploiement du client (`pages`) et du serveur (`deploy:server`). Lancez la _job_ `pages` pour déployer le site web. Pour le moment, vous pouvez ignorer la _job_ `deploy:server`.
-   Naviguez sur le menu `Jobs` pour vérifier l'état de la _job_ `pages`. Lorsque le travail se termine (+/- 2 minutes), le site sera déployé et la configuration de votre _Page_ sera disponible dans le menu `Pages`.
-   Naviguez sur le menu de `Pages` disponible dans `Deploy > Pages` et retirez les options de domaine unique et l'utilisation de HTTPS forcée. Sauvegardez ces changements. **Attention** : Gitlab Pages utilise un mécanisme de cache assez agressif : il se peut que vous deviez attendre quelques minutes avant de voir les changements et pouvoir accéder à votre site web. Vous pouvez essayer d'_invalider_ la cache en rendant le site visible à tous (ne sera pas toujours respecté par le serveur statique). Voir la section [suivante](#comment-faire-pour-quon-puisse-accéder-à-mon-site-sans-être-connecté-à-gitlab) pour plus d'informations.

**Attention** : le menu `Pages` n'est pas disponible avant le premier déploiement. Si vous y accédez avant, vous serez invités à créer une nouvelle configuration de déploiement (fichier `gitlab-ci.yaml`). Ceci effacera la configuration existante et il faudra _revert_ le commit de changement. Veillez à suivre les étapes ci-dessus avant d'accéder à cette page.

## Configurations spécifiques 

**Important** : assurez-vous d'avoir bien retiré les deux options de la dernière étape de déploiement avant d'accéder à la page pour la première fois. La page sera mise en cache avec la mauvaise configuration pendant 10 minutes (en-tête `max-age=600`).

Par défaut, votre page web sera servie par un serveur statique **HTTPS**, mais votre serveur dynamique sera un simple serveur **HTTP**. Pour des raisons de sécurité, les navigateurs ne permettent pas à ce qu'une page servie par **HTTPS** récupère une ressource d'une origine **HTTP**. Afin de permettre à votre site web de communiquer avec votre serveur, vous devez décocher l'option **Force HTTPS (requires valid certificates)** dans le menu `Pages`. Ceci permet donc d'accéder à votre site web par **HTTP** et établir un contact fonctionnel avec votre serveur dynamique. L'adresse de votre site restera la même, mais vous devez utiliser l'URL débutant par `http://` au lieu de `https://`.

GitLab génère un lien unique pour votre site web. Cependant, la configuration définie ici s'attend à un chemin spécifique (`BASE_HREF`) pour lier les différentes ressources statiques. Le domaine unique brisera ces liens : il faudra donc retirer cette option. *Note* : vous pouvez, si vous voulez, associer votre propre domaine à votre site web. Vous devez cependant vous assurer que la page est accessible par le domaine par défaut à configurer pour le cours.

### Gestion des routes par Angular

Votre site web est une application mono-page (_SPA_) composée d'un seul document HTML qui utilise des routes pour naviguer entre les différentes _pages_ qui ne sont que des Components d'Angular différents. Le projet est configuré pour utiliser [HashLocationStrategy](https://angular.dev/api/common/HashLocationStrategy) et un `#` sera inséré avant chaque route (Voir la configuration dans [main.ts](./client/src/main.ts)).

Vos URIs termineront alors par `LOG2995-XYZ/#/abc` et non `LOG2995-XYZ/abc`. Sans le `#`, le serveur statique tentera de trouver `abc.html` qui n'existe pas et retournera un code `404` et une page d'erreur. Avec le `#`, Angular interceptera la requête et affichera le composant correspondant à la route `/abc`. Par défaut, votre site web sera donc accessible sur `LOG2995-XYZ/#/home`.

Ceci permet de naviguer correctement entre les différentes _pages_ de votre site web et ne pas retourner une page invalide en cas de rechargement de la page. Ce comportement n'est pas le même pour le serveur statique local qui n'est pas impacté par la présence ou non de `#` dans l'URI. Il est donc important de tester les routes de votre site web sur GitLab Pages pour s'assurer qu'elles fonctionnent correctement.

### Accès au serveur dynamique

Si vous n'avez pas encore configuré le déploiement du serveur dynamique, la communication entre les deux parties ne sera pas fonctionnelle. Nous vous conseillons de configurer le déploiement du serveur dynamique et de revenir à cette section par la suite. 

Vous aurez besoin de l'adresse IP de votre serveur dynamique pour communiquer avec. Durant un déploiement local, vous travaillez avec un serveur dynamique sur `localhost:3000` et une page web servie de la même machine (serveur statique sur `localhost:4200`).

Durant un déploiement en production, la page web sera servie par un serveur statique sur une machine différente que le serveur dynamique. Vous devez donc spécifier son adresse. Cette configuration a lieu dans le [fichier d'environnement de production](client/src/environments/environment.prod.ts). Lors d'un build en mode production (ex. celui du déploiement sur GitLab Pages), ce fichier remplacera [celui de développement](client/src/environments/environment.ts). Faisant en sorte qu'en mode production ou développement, les ressources correspondantes soient utilisées. Consulter [ce fichier](client/angular.json) à la ligne 56 pour plus de détails.

**Important** : si l'instance AWS qui héberge votre serveur dynamique est redémarrée, l'adresse IP de votre serveur dynamique changera. Vous devrez donc mettre à jour l'adresse IP dans le fichier d'environnement de production et redéployer votre site web pour tenir compte des changements.

## Déploiement automatique du site web

Après avoir correctement fait les configurations initiales, vous pouvez déployer votre site web à plusieurs reprises de la même manière. Vous n'êtes pas obligés de déployer le site web ET le serveur à chaque fois même si le tag déclenche une _job_ manuelle pour les deux: vous pouvez faire des déploiements partiels.

Notez qu'une seule version du site peut être déployée à la fois. Comme la page est en cache pendant 10 minutes, vous devez attendre ce délai ou vider votre cache pour voir les changements (attention à ne pas vider la cache de Gitlab au complet et être déconnecté de votre compte).

# Déploiement manuel du serveur

Le déploiement manuel se fait sur une machine distante communément appelée serveur. Dans notre cas-ci, nous utiliserons le service _Elastic Cloud Compute (EC2)_ du fournisseur Cloud Amazon (AWS) pour obtenir une machine virtuelle. Après l'obtention de notre machine, nous allons copier les fichiers du projet et lancer le serveur en exposant les ports nécessaires.

## Accès à la console AWS

Avant de commencer, vous aurez besoin d'un compte AWS. Vous pouvez vous en créer un à partir de l'adresse suivante : [ca-central-1.console.aws.amazon.com](https://ca-central-1.console.aws.amazon.com). Tout au long du tutoriel, vous devriez rester à la région `ca-central-1` située à Montréal. Assurez-vous toujours bien de cela.

La page d'accueil de la console AWS devrait être similaire à ceci :

![Console AWS](static/console_aws.png)

## Création d'un rôle IAM

Nous allons configurer le rôle `IAM` qui sera utilisé par notre Serveur. Ce rôle définit les services auxquels notre serveur pourra accéder. Allez dans la barre de recherche principale, tapez `IAM` et accédez au service.

![Recherche AWS IAM](static/aws_iam_search.png)

Aller à l'onglet `Rôles` et cliquer sur `Créer un rôle`. Vous devrez voir un assistant à trois étapes comme sur la capture suivante. Comme type d'entité de confiance, choisir `Service AWS`. Comme cas d'utilisation, choisir `EC2`. Cliquer sur le bouton `Suivant`.

![Créer un rôle dans AWS IAM](static/aws_iam_creer_un_role.png)

À l'étape des autorisations, assurez-vous de bien choisir les stratégies `AmazonEC2FullAccess` et `CloudWatchFullAccess`. Cliquer ensuite sur `Suivant` pour arriver à la dernière étape de l'assistant.

![Sélection des politiques d'autorisations dans AWS IAM](static/aws_iam_roles.png)

**Qu'est-ce que CloudWatch ?** CloudWatch est un service AWS. Dans le cadre de notre projet, nous l'utiliserons pour accéder aux logs de la VM directement depuis la console AWS.

Comme nom de rôle vous pouvez utiliser `AmazonEC2CloudWatchFullAccess` et comme description la même que celle sur la capture suivante. Cliquer sur `Créer un rôle`.

![Configuration des informations concernant le rôle IAM](static/aws_iam_role_information.png)

![Configuration des informations concernant le rôle IAM (2)](static/aws_iam_role_information_2.png)

## Création d'une paire de clés

Vous devez maintenant créer une paire de clés qui vous permettra d'avoir accès à votre serveur. Allez dans la barre de recherche principale et accédez au service `EC2`. Accédez à l'onglet `Paires de clés` dans la catégorie `Réseau et sécurité`. Cliquez ensuite sur l'option `Créer une paire de clés`.

![Tableau de bord pour les paires de clés dans AWS EC2](static/aws_ec2_paires_de_cles_tableau_de_bord.png)

Remplissez les champs comme suit et créer la paire de clés. La clé privée sera automatiquement téléchargée. Sauvegarder la clé privée dans un dossier où vous ne la perdrez pas (e.g. : `~/.ssh/`).

![Créer une paire de clés](static/creeer_paire_de_cles.png)

## Création d'un groupe de sécurité

Un groupe de sécurité définit des règles permettant de contrôler le trafic entrant et sortant. Allez dans le service `EC2` via la barre de recherche principale et accédez à l'onglet `Groupes de sécurité` dans la catégorie `Réseau et sécurité`. Cliquer sur le bouton `Créer un groupe de sécurité`.

![Groupes de sécurité dans AWS EC2](static/groupes_de_securite.png)

Remplissez les règles entrantes comme suit et ensuite créez le groupe de sécurité :

Pour l'accès SSH (accès à distance au serveur) :

-   Type: SSH
-   Source: N'importe où - IPv4

Pour votre serveur dynamique :

-   Type: Règle TCP personnalisée
-   Règle: TCP
-   Plage de ports: 3000
-   Source: N'importe où - IPv4
-   Description (Optionnel): Port du serveur dynamique

![Création d'un groupe de sécurité dans AWS EC2 (1)](static/creer_groupe_de_securite_1.png)
![Création d'un groupe de sécurité dans AWS EC2 (2)](static/creer_groupe_de_securite_2.png)

## Création et démarrage d'une machine virtuelle

Vous êtes enfin prêt à démarrer une instance `EC2`. Ouvrez le menu déroulant `Services` et choisissez le service de calcul `EC2`. Aller ensuite sur l'onglet `Instances` et cliquer sur le bouton `Lancer des instances`.

![Instances EC2](static/aws_ec2_instances_tableau_de_bord.png)

Vous devez ensuite voir un assistant à plusieurs étapes qui nous guidera à configurer les paramètres de l'instance (Figure ci-dessous).

![Assistant de lancement d'instance](static/assistant_de_lancement_d_instance.png)

### Étape 1 : Nom et balises

Donnez un nom à votre serveur. Ex : `Projet2Server`.

### Étape 2 : Images d'applications et de systèmes d'exploitation (Amazon Machine Image)

Choisissez l'AMI `Amazon Linux 2023`.

![Choix de l'AMI](static/choix_ami.png)

### Étape 3 : Type d'instance et paire de clés (connexion)

Comme type d'instance, choisir `t3.micro` (ou autre configuration éligible à l'offre gratuite) et comme paire de clés, celle que vous avez créée précédemment.

![Type d'instance](static/type_d_instance.png)
![Paire de clés](static/paire_de_cles.png)

**Restrictions de l'offre gratuite** : Avec l'offre gratuite, vous avez droit à 750 h de calcul gratuit renouvelable chaque mois pour les 12 premiers mois. Évitez donc de lancer plusieurs instances simultanément puisque le temps de calcul sera cumulé.

### Étape 4 : Paramètres réseau

Assurez-vous de sélectionner le groupe de sécurité précédemment créé.

![Choix du groupe de sécurité](static/parametres_reseau.png)

### Étape 5 : Configurer le stockage

Choisissez entre 20 et 30 Gio de stockage.

![Configurer le stockage](static/configurer_le_stockage.png)

### Étape 6 : Détails avancés

Assurez-vous de choisir le profil d'instance IAM que vous avez précédemment créé.

![Configurer le profil d'instance IAM](static/profile_d_instance_iam.png)

### Étape 7 : Lancer l'instance

Cliquez sur le bouton `Lancer l'instance` pour finaliser la procédure.

![Lancer l'instance](static/lancer_l_instance.png)

## Accès à votre machine distance

**Attention :** l'adresse DNS publique de votre instance n'est pas persistante. Elle changera à chaque fois que vous redémarrerez ou fermez/ouvrez votre instance. Prenez ceci en compte lors de la connexion à votre machine. 

Retournez au [Tableau de bord EC2](https://ca-central-1.console.aws.amazon.com/ec2/v2/home?region=ca-central-1#Instances:) (`Services -> EC2 -> Instances`). Aussitôt que l'état de votre machine passera à `En cours d'exécution`, cela signifiera que votre machine est prête à être utilisée.
Pour y avoir accès, nous allons utiliser une connexion `SSH`.

1. Pour les utilisateurs Linux, exécutez, si nécessaire, cette commande pour vous assurer que votre clé n’est pas visible publiquement par les autres utilisateurs.

```sh
chmod 400 chemin/vers/ec2-key.pem
```

2. Connectez-vous à votre instance à l’aide de son DNS public (disponible dans les détails de l'instance) :

```sh
ssh -i chemin/vers/ec2-key.pem ec2-user@<dns-public-de-votre-machine>
```

Si par la suite vous désirez quitter la connexion `SSH` et revenir à votre terminal, vous pouvez taper la commande :

```sh
exit
```

![Connexion à la VM avec un Client SSH](static/connexion_ssh.png)

**Attention : L'adresse DNS publique sur la capture d'écran sera complètement différente de la votre. Ne la recopiez pas. Utilisez celle qui a été assignée à votre machine virtuelle disponible dans les détails de l'instance.**

À cette étape-ci, vous avez accès à la machine et vous pouvez exécuter n'importe quelle commande `sh` que vous vouliez.

## Lancer votre serveur

1. Installez les dépendances nécessaires

```sh
sudo yum install -y git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
nvm alias default node
npm install forever -g
```

2. Récupérez les fichiers de votre projet

```sh
git clone <url-de-votre-projet> repo
cd repo/server
git checkout <branche, tag ou SHA du commit>
```

3. Installez les dépendances du projet avec `npm`

```sh
npm ci
```

4. Lancez le serveur

```sh
npm start
```

Bravo, vous devriez être en mesure d'accéder à votre serveur depuis l'adresse : `<dns-public-de-votre-machine>:3000`. N'oubliez pas de mettre à jour le [fichier d'environnement de production](client/src/environments/environment.prod.ts) et de bien garder `http://` au début de la valeur de la variable. Gardez en tête que l'adresse va changer si l'instance est redémarrée ou relancée.

**Important:** un tel lancement de votre serveur est temporaire. Un arrêt du processus ou un arrêt de la connexion SSH à la machine entraînera l'arrêt du serveur. Pour un déploiement permanent, vous allez utiliser un service de gestion de processus `forever`. Consultez la [fin du fichier `.gitlab-ci.yml`](.gitlab-ci.yml) pour voir les commandes utilisées pour le lancement du serveur ainsi que la manière d'arrêter un processus `forever`.

## Vérification du déploiement du serveur

Vous pouvez vérifier si votre serveur est bien en ligne en accédant à l'adresse `http://<dns-public-de-votre-machine>:3000` dans votre navigateur. Vous devriez voir une page web avec la documentation Swagger de votre API.

Pour vérifier la communication du site-web au serveur, vous pouvez changer le fichier d'environnement local (`environment.ts`) pour qu'il pointe vers votre serveur distant, lancer le serveur statique local et vérifier que les requêtes de votre page web sont bien envoyées au serveur distant.

Finalement, vous pouvez modifier le fichier d'environnement de production (`environment.prod.ts`) pour qu'il pointe vers votre serveur distant et déployer votre site web sur GitLab Pages. Vous devriez être en mesure de voir votre site web communiquer avec votre serveur distant, le tout, en mode _production_.

# Déploiement automatique du serveur

Pour faire marcher le pipeline, 4 [variables](https://docs.gitlab.com/ee/ci/variables/) devront être définies : `EC2_HOST`, `EC2_PEM_FILE_CONTENT`, `EC2_USER`, et `SERVER_PORT`. Toutes ces variables pourront être définies à partir de GitLab sur la page `Settings > CI/CD > Variables`. Attention : ne pas masquer `EC2_PEM_FILE_CONTENT`.

#### EC2_HOST

Cette variable correspond à l'adresse de votre machine EC2 déployée. Vous y avez accès dans les détails de l'instance sous le nom de **Adresse DNS Publique**. Cette valeur doit avoir le schéma suivant : `ec2-<un nombre quelconque>.ca-central-1.compute.amazonaws.com` (sans `http://` au début).

#### EC2_PEM_FILE_CONTENT

Cette variable correspond au fichier de permission `.pem` que vous aviez généré. Voici un exemple de fichier de permission :

```
-----BEGIN RSA PRIVATE KEY-----
MIIB9TCCAWACAQAwgbgxGTAXBgNVBAoMEFF1b1ZhZGlzIExpbWl0ZWQxHDAaBgNV
BAsME0RvY3VtZW50IERlcGFydG1lbnQxOTA3BgNVBAMMMFdoeSBhcmUgeW91IGRl
Y29kaW5nIG1lPyAgVGhpcyBpcyBvbmx5IGEgdGVzdCEhITERMA8GA1UEBwwISGFt
aWx0b24xETAPBgNVBAgMCFBlbWJyb2tlMQswCQYDVQQGEwJCTTEPMA0GCSqGSIb3
DQEJARYAMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCJ9WRanG/fUvcfKiGl
EL4aRLjGt537mZ28UU9/3eiJeJznNSOuNLnF+hmabAu7H0LT4K7EdqfF+XUZW/2j
RKRYcvOUDGF9A7OjW7UfKk1In3+6QDCi7X34RE161jqoaJjrm/T18TOKcgkkhRzE
apQnIDm0Ea/HVzX/PiSOGuertwIDAQABMAsGCSqGSIb3DQEBBQOBgQBzMJdAV4QP
Awel8LzGx5uMOshezF/KfP67wJ93UW+N7zXY6AwPgoLj4Kjw+WtU684JL8Dtr9FX
ozakE+8p06BpxegR4BR3FMHf6p+0jQxUEAkAyb/mVgm66TyghDGC6/YkiKoZptXQ
98TwDIK/39WEB/V607As+KoYazQG8drorw==
-----END RSA PRIVATE KEY-----
```

L'intégralité du fichier devra être copiée dans la variable `EC2_PEM_FILE_CONTENT`.
Note : ne masquez pas cette variable pour que le pipeline puisse y accéder. Assurez-vous de ne pas introduire des espaces ou des retours à la ligne à la fin de la variable.

#### EC2_USER

Cette variable représente l'utilisateur auquel se connecter sur le serveur distant, soit `ec2-user`. Cette valeur est déjà définie dans le fichier [.gitlab-ci.yml](.gitlab-ci.yml).

#### SERVER_PORT

Cette variable représente le port sur lequel votre serveur opère. Donnez-y la valeur `3000`.

\
Au cours du déploiement automatique, l'agent [Amazon CloudWatch Agent](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Install-CloudWatch-Agent.html) est installé sur votre instance EC2. Cet agent se charge de collecter les journaux (_logs_) de votre serveur et de les envoyer aux service AWS CloudWatch. Directement dans le service [CloudWatch](https://ca-central-1.console.aws.amazon.com/cloudwatch/home?region=ca-central-1#logsV2:log-groups) vous avez accès aux logs de votre serveur sous les onglets `Journaux > Groupes de journaux > /var/log/messages > <ID de l'instance>`.

![AWS CloudWatch Logs](static/cloud_watch_1.png)

# FAQ

## Dans le cas d'un déploiement du site web : 
- Vérifier que le chemin de base est bien configuré dans les variables CI/CD.
- Vérifier que `HTTPS` n'est pas forcé et vous n'accédez pas à la page en `HTTPS`.
- Vérifier que la variable d'environnement de production est bien configurée pour accéder au serveur dynamique.

## Dans le cas d'un déploiement de serveur : 
- Vérifier que les port d'entrée et sortie sont bien configurés dans le groupe de sécurité.
- Vérifier que l'instance AWS est accessible en SSH minimalement.
- Vérifier que le serveur est bien lancé et que le port est bien ouvert.
- Arrêter tout processus Node sur le port 3000 (`forever stopall && sudo fuser -k '3000/tcp' && sudo killall node`) et relancer le serveur dynamique (`PORT=3000 forever start -a -l /var/log/messages out/server/app/index.js`)
- En dernier recours, redémarrer l'instance AWS, mettre à jour sa nouvelle adresse aux endroits appropriés (`environment.prod.ts`) et redéployer.

## Dans tous les cas : 

- **Lisez les erreurs dans la console.**

## Le pipeline fail à la dernière étape car le fichier index.js n'existe pas

Essayez de transpiler votre serveur localement (`npm run build`) et assurez-vous que le chemin vers le fichier `index.js` compilé dans le dossier `out/` correspond bien à celui se trouvant dans [la dernière ligne du CI](.gitlab-ci.yml). Ceci peut arriver si vous avez retiré les références aux fichiers du répertoire `common`.

## Le déploiement fonctionne, mais le client n'arrive pas à se connecter au socket

Vérifiez que les fichiers environnements sont bien configurés, que vous avez désactivé `Force HTTPs`, Refaire un nouveau déploiement en cas de changement de configuration et enfin que vous accédez à votre site web en HTTP et non HTTPS (**très important**).

## J'essaie d'accéder au site web en HTTPS, mais je suis redirigé vers une page GitLab : *401 You don't have permission to access the resource.*. Comment résoudre ce problème ?

Il faut désactiver la redirection dans les paramètres de Chrome. 
Pour le faire, entrez `chrome://net-internals/#hsts` dans votre barre de recherche. Dans la section `Delete domain security policies`, entrez le domaine `polytechnique-montr-al.gitlab.io`, puis cliquez sur `Delete`.

## Le déploiement Gitlab Pages fonctionne, mais je reçois une erreur de Gitlab du genre 401 Unauthorized

Le problème est souvent dû à un problème de cache. Réessayer de vider la cache de votre fureteur, se connecter sur un autre fureteur comme Edge ou Firefox.

## Comment faire pour qu'on puisse accéder à mon site sans être connecté à GitLab

Il faut modifier les accès au site web.
Pour le faire, sur GitLab, allez dans `Settings` → `General` → `Visibility, project features, permissions` → `Pages`. Modifiez la valeur `Only Project Members` pour `Everyone`.

⚠️ Attention : en modifiant cette configuration, le site de votre projet sera accessible par **n'importe quelle personne** ayant une connexion Internet.

## Le déploiement fonctionne mais les images ne se chargent pas

Il faut mettre à jour la variable CI `BASE_HREF` en lui donnant la valeur : `/log2995/202AB/equipe-XYZ/LOG2995-XYZ/`. Ensuite, changer tous les URLs CSS pour qu’ils aient un format relatif tel que `../../../assets/mon-asset.extension` et les URLs HTML pour qu'ils aient le format `./assets/mon-asset.extension`. En utilisant ces formats, le compilateur Angular concaténera l'origine (http://polytechnique-montr-al.gitlab.io/), le base href et le chemin vers le fichier. Si vous voulez charger dynamiquement des images dans le ts vous devez faire la concaténation vous-même ([voir l'exemple suivant](https://itnext.io/how-to-extract-the-base-href-in-angular-bbbd559a1ad6)).

## Le pipeline du déploiement du client se termine avec succès, mais une erreur dans la console m'empêche de charger le site lorsque je tente de le consulter. Comment résoudre le problème.

Il faut vérifier la configuration de la variable `BASE_HREF` dans les paramètres GitLab.
Vérifier le format (ne pas oublier le `/` à la fin), le flag protégée et le flag masquée.

## J'ai tout fait, mais le pipeline ne marche toujours pas

Prendre une grande respiration. S'assurer d'avoir bien mis les noms de variables, vérifier les fins de lignes de chaque variable. Ne serait-ce qu'un espace en trop peut faire échouer tout le déploiement. N'utilisez pas de variables protégées dans les variables CI/CD.
