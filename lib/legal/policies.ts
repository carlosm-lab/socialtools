import { LegalPolicy, LegalHubDocItem } from './types';

export const SITE_URL = 'https://www.socialtools.click';
export const OPERATOR_NAME = 'Carlos José Molina Villacorta';
export const OPERATOR_GITHUB = 'carlosm-lab';
export const OFFICIAL_EMAIL = 'negocios.axkarl@gmail.com';
export const PADDLE_SELLER_ID = '471198';

export const LEGAL_HUB_DOCS: LegalHubDocItem[] = [
  {
    slug: 'privacidad',
    title: 'POLÍTICA DE PRIVACIDAD',
    tagline: 'Procesamiento 100% local en RAM, Google OAuth y protección estricta de datos personales.',
    icon: 'shield',
    available: true,
    readingTime: 14,
  },
  {
    slug: 'terminos',
    title: 'TÉRMINOS Y CONDICIONES',
    tagline: 'Condiciones de servicio, licenciamiento SaaS, créditos de video y reglas operativas.',
    icon: 'file-text',
    available: true,
    readingTime: 18,
  },
  {
    slug: 'reembolsos',
    title: 'POLÍTICA DE NO REEMBOLSO',
    tagline: 'Carácter firme, definitivo e irrevocable de la compra de créditos por uso y suscripciones.',
    icon: 'rotate-ccw',
    available: true,
    readingTime: 12,
    highlight: 'Estricta',
  },
  {
    slug: 'aviso-legal',
    title: 'AVISO LEGAL',
    tagline: 'Identificación oficial del titular, propiedad intelectual y Paddle como Merchant of Record.',
    icon: 'scale',
    available: true,
    readingTime: 10,
  },
  {
    slug: 'cookies',
    title: 'POLÍTICA DE COOKIES',
    tagline: 'Cookies técnicas de sesión, almacenamiento local no invasivo y cero rastreadores publicitarios.',
    icon: 'cookie',
    available: true,
    readingTime: 10,
  },
];

export const LEGAL_POLICIES: Record<string, LegalPolicy> = {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. POLÍTICA DE PRIVACIDAD
  // ───────────────────────────────────────────────────────────────────────────
  privacidad: {
    slug: 'privacidad',
    title: 'Política de Privacidad y Protección de Datos',
    metaTitle: 'Política de Privacidad y Protección de Datos | SocialTools',
    metaDescription:
      'Política oficial de privacidad de SocialTools: procesamiento de video 100% local en RAM vía WebAssembly, Google OAuth 2.0 y aislamiento financiero con Paddle.',
    keywords: [
      'política de privacidad',
      'privacidad socialtools',
      'protección de datos',
      'procesamiento local webassembly',
      'google oauth',
      'paddle merchant of record',
    ],
    category: 'DOCUMENTOS LEGALES',
    tagline: 'Regulación exhaustiva sobre cómo recopilamos, usamos, almacenamos y protegemos tus datos personales y privacidad.',
    icon: 'shield',
    date: '11 Nov, 2026',
    lastUpdated: '11 de noviembre de 2026',
    readingTime: 14,
    available: true,
    sections: [
      {
        n: 1,
        title: 'Introducción y Ámbito de Aplicación',
        paragraphs: [
          'SocialTools (accesible a través de https://www.socialtools.click) es una plataforma avanzada de software como servicio (SaaS) especializada en el análisis forense, stripping de metadatos C2PA/EXIF/XMP y neutralización de firmas esteganográficas generativas en archivos audiovisuales.',
          'Esta Política de Privacidad regula el tratamiento de datos personales de los usuarios que interactúan con la plataforma, de plena conformidad con el Reglamento General de Protección de Datos de la Unión Europea (RGPD 2016/679), la Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD 3/2018), y las mejores prácticas internacionales de privacidad por diseño y por defecto.',
          'Al acceder a SocialTools o autenticarse mediante Google OAuth, usted acepta de forma inequívoca las prácticas descritas en este documento. Si no está de acuerdo con alguna de ellas, debe abstenerse de utilizar los servicios que requieran autenticación.',
        ],
      },
      {
        n: 2,
        title: 'Responsable del Tratamiento de Datos',
        paragraphs: [
          'El titular y responsable directo del tratamiento de los datos personales recopilados a través de la plataforma es:',
        ],
        list: [
          'Titular / Operador: Carlos José Molina Villacorta (cuenta técnica GitHub: carlosm-lab).',
          'Nombre Comercial: SocialTools Studio (SocialTools).',
          'Sitio Web Oficial: https://www.socialtools.click.',
          'Correo Electrónico de Privacidad y Ejercicio de Derechos: negocios.axkarl@gmail.com.',
        ],
      },
      {
        n: 3,
        title: 'Cero Subida de Archivos y Procesamiento 100% Local en RAM',
        paragraphs: [
          'El pilar arquitectónico fundamental de SocialTools es la absoluta privacidad multimedia.',
          'Todo el procesamiento de archivos de video (MP4, MOV, WebM) para el análisis forense de metadatos, la eliminación de bloques C2PA, EXIF y XMP, y la aplicación de algoritmos de variación se ejecuta ÍNTEGRAMENTE dentro de la memoria RAM del navegador del usuario utilizando tecnología WebAssembly (@ffmpeg/ffmpeg) y Web Workers aislados.',
          'En NINGÚN MOMENTO los archivos de video del usuario se suben, transmiten, copian ni almacenan en los servidores de SocialTools ni en infraestructuras en la nube de terceros. Los videos nunca abandonan su dispositivo local. Toda la decodificación, filtrado y reencapsulado ocurre en local y se destruye de la memoria volátil tan pronto como usted cierra la pestaña o limpia la cola de trabajo.',
        ],
        infoBox: {
          type: 'green',
          title: 'Garantía de Procesamiento Local en Cliente',
          text: 'Sus archivos de video son estrictamente privados. SocialTools jamás almacena, analiza ni tiene acceso a sus videos en servidores externos.',
        },
      },
      {
        n: 4,
        title: 'Datos Personales que Recopilamos y Finalidad',
        paragraphs: [
          'La plataforma únicamente recopila los datos personales estrictamente indispensables para la prestación del servicio y la gestión de la cuenta:',
        ],
        subSections: [
          {
            title: 'a) Autenticación mediante Google OAuth 2.0',
            content: [
              'Al iniciar sesión con Google Identity Services, recopilamos los datos autorizados en el consentimiento OAuth: identificador único de cuenta de Google (sub), nombre completo, dirección de correo electrónico y URL del avatar o foto de perfil pública.',
              'Finalidad: Identificar de forma unívoca la cuenta del usuario, mantener su sesión activa de forma segura y asociar sus créditos de video y planes contratados.',
            ],
          },
          {
            title: 'b) Saldo de Créditos y Entitlements de Cuenta',
            content: [
              'Almacenamos en nuestra base de datos persistente el saldo numérico de créditos de video disponibles, el historial de deducciones por exportaciones completadas, el crédito de bienvenida (1 crédito gratuito otorgado en primer login) y la asignación de licencias activas.',
              'Cuenta de administración: La cuenta negocios.axkarl@gmail.com cuenta con asignación de acceso ilimitado permanente sin restricciones de saldo.',
            ],
          },
          {
            title: 'c) Datos que NO Recopilamos',
            content: [
              'SocialTools NO recopila ni almacena información bancaria, números de tarjetas de crédito o débito, fechas de vencimiento ni códigos de seguridad CVV/CVC. Todo el flujo financiero es gestionado de manera aislada e independiente por Paddle.com.',
            ],
          },
        ],
      },
      {
        n: 5,
        title: 'Bases Jurídicas del Tratamiento',
        paragraphs: [
          'El tratamiento de sus datos se fundamenta en las siguientes bases legales del RGPD (artículo 6):',
        ],
        list: [
          'Ejecución de un contrato (art. 6.1.b): Para proveer el acceso a la plataforma, gestionar su saldo de créditos de video y permitir la exportación de material procesado.',
          'Consentimiento explícito (art. 6.1.a): Otorgado libremente al autorizar el inicio de sesión a través del protocolo Google OAuth 2.0.',
          'Cumplimiento de obligaciones legales (art. 6.1.c): Para coordinar la facturación y validación de transacciones con Paddle.com en cumplimiento de normativas fiscales y contables.',
          'Interés legítimo (art. 6.1.f): Para prevenir abusos, proteger la seguridad técnica de la API y garantizar la estabilidad del servicio.',
        ],
      },
      {
        n: 6,
        title: 'Terceros Proveedores e Infraestructura Tecnológica',
        paragraphs: [
          'Para operar la plataforma, compartimos información mínima con los siguientes proveedores especializados bajo estrictos acuerdos de confidencialidad y encargo de tratamiento:',
        ],
        list: [
          'Google LLC (Google Cloud Console): Proveedor del servicio de autenticación federada OAuth 2.0.',
          'Paddle.com Market Ltd & Paddle Payments Ltd: Comerciante Registrado (Merchant of Record). SocialTools transfiere únicamente identificadores técnicos y el correo del usuario en el objeto customData ({ userId, userEmail, purchaseType, videoCredits }) para conciliar los créditos adquiridos.',
          'Vercel Inc.: Infraestructura de despliegue web y red de distribución de contenidos (CDN).',
        ],
        infoBox: {
          type: 'blue',
          title: 'Cero Comercialización de Datos',
          text: 'SocialTools no vende, no alquila y no comparte sus datos personales con redes de publicidad ni empresas de marketing de terceros.',
        },
      },
      {
        n: 7,
        title: 'Medidas de Seguridad Técnicas y Organizativas',
        paragraphs: [
          'Implementamos salvaguardas de nivel corporativo para proteger sus datos:',
          '1. Cifrado integral en tránsito mediante protocolo HTTPS forzado bajo TLS 1.3.',
          '2. Gestión de sesiones mediante cookies HTTP-only con banderas Secure y SameSite=Lax para prevenir ataques de Cross-Site Scripting (XSS).',
          '3. Cabeceras de seguridad Cross-Origin Opener Policy (COOP) y Cross-Origin Embedder Policy (COEP) configuradas para el aislamiento estricto de WebAssembly y memoria compartida (SharedArrayBuffer).',
          '4. Aislamiento absoluto de claves de API (Paddle API Keys, Google Client Secret) en variables de entorno del servidor inaccesibles desde el código cliente.',
        ],
      },
      {
        n: 8,
        title: 'Almacenamiento Local en el Navegador (localStorage)',
        paragraphs: [
          'La plataforma utiliza localStorage de forma no invasiva para conservar el estado de la interfaz de usuario, la caché de consulta del balance de créditos (st_credits_cache) y las preferencias visuales.',
          'Asimismo, sessionStorage se utiliza para gestionar la bandera socialtools_legal_return que evita el parpadeo de animaciones al regresar desde el lector legal hacia el hub /legal.',
          'Estos datos residen exclusivamente en su dispositivo y pueden ser purgados en cualquier instante a través de los ajustes de su navegador.',
        ],
      },
      {
        n: 9,
        title: 'Uso de Cookies',
        paragraphs: [
          'SocialTools utiliza de forma exclusiva cookies técnicas imprescindibles para la autenticación de sesión y el funcionamiento del modal de pago seguro de Paddle. No empleamos cookies analíticas invasivas ni cookies de publicidad comportamental.',
          'Para una descripción pormenorizada de cada cookie, consulte nuestra Política de Cookies en /legal/cookies.',
        ],
      },
      {
        n: 10,
        title: 'Plazo de Conservación de los Datos',
        paragraphs: [
          'Los datos vinculados a su cuenta de usuario y su registro de créditos se conservarán mientras su cuenta permanezca activa en la plataforma.',
          'En caso de solicitar la eliminación de su cuenta, sus datos identificativos serán eliminados o anonimizados de nuestra base de datos en un plazo máximo de 30 días, salvo aquellos registros de facturación que deban conservarse por imperio legal para responder ante autoridades fiscales o auditorías de Paddle.',
        ],
      },
      {
        n: 11,
        title: 'Derechos del Usuario (ARCO y RGPD)',
        paragraphs: [
          'En virtud de la legislación de protección de datos, usted ostenta los siguientes derechos irrenunciables:',
        ],
        list: [
          'Derecho de Acceso: Conocer qué datos personales suyos están siendo tratados.',
          'Derecho de Rectificación: Solicitar la corrección de datos inexactos o incompletos.',
          'Derecho de Supresión (Derecho al Olvido): Solicitar la eliminación definitiva de su cuenta y datos asociados.',
          'Derecho a la Limitación del Tratamiento: Solicitar que se congele el uso de sus datos en supuestos legalmente previstos.',
          'Derecho a la Portabilidad: Recibir sus datos en formato estructurado de uso común.',
          'Derecho de Oposición: Oponerse al tratamiento de sus datos en cualquier momento.',
        ],
        footnote:
          'Para ejercer cualquiera de estos derechos, remita un correo a negocios.axkarl@gmail.com con el asunto "Ejercicio de Derechos de Privacidad", adjuntando prueba fehaciente de su identidad.',
      },
      {
        n: 12,
        title: 'Menores de Edad',
        paragraphs: [
          'El uso de SocialTools está restringido a personas mayores de 18 años o que posean la mayoría de edad legal en su jurisdicción. No recopilamos intencionadamente datos de menores de edad. Si un padre o tutor detecta que un menor ha registrado una cuenta sin autorización, debe contactarnos para proceder a su cancelación inmediata.',
        ],
      },
      {
        n: 13,
        title: 'Transferencias Internacionales de Datos',
        paragraphs: [
          'Habida cuenta de que proveedores como Google LLC y Paddle Payments Ltd operan con infraestructuras globales, sus datos pueden ser procesados en servidores ubicados en Estados Unidos o el Espacio Económico Europeo.',
          'Dichas transferencias se encuentran respaldadas por Cláusulas Contractuales Tipo (SCC) aprobadas por la Comisión Europea y por las certificaciones del Marco de Privacidad de Datos UE-EE.UU. (Data Privacy Framework).',
        ],
      },
      {
        n: 14,
        title: 'Modificaciones y Vigencia de la Política',
        paragraphs: [
          'Nos reservamos el derecho de modificar la presente política para adaptarla a novedades legislativas o mejoras técnicas en la plataforma.',
          'Toda actualización será publicada en esta misma dirección URL con la fecha de última revisión. Le aconsejamos consultar esta página de forma periódica.',
        ],
        footnote:
          'Esta Política de Privacidad está en vigor desde el 11 de noviembre de 2026 y rige para todas las sesiones iniciadas en SocialTools.',
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 2. TÉRMINOS Y CONDICIONES DE SERVICIO
  // ───────────────────────────────────────────────────────────────────────────
  terminos: {
    slug: 'terminos',
    title: 'Términos y Condiciones de Servicio',
    metaTitle: 'Términos y Condiciones de Servicio | SocialTools',
    metaDescription:
      'Términos y condiciones legales de SocialTools: reglas de uso de software, compras de créditos, planes de suscripción y limitación de responsabilidad.',
    keywords: [
      'términos y condiciones',
      'condiciones de servicio',
      'contrato de software',
      'créditos de video',
      'plan creador anual',
      'paddle merchant of record',
    ],
    category: 'DOCUMENTOS LEGALES',
    tagline: 'Condiciones generales vinculantes que rigen el acceso, licencias, créditos y uso de SocialTools.',
    icon: 'file-text',
    date: '11 Nov, 2026',
    lastUpdated: '11 de noviembre de 2026',
    readingTime: 18,
    available: true,
    sections: [
      {
        n: 1,
        title: 'Aceptación de los Términos',
        paragraphs: [
          'Los presentes Términos y Condiciones de Servicio (en adelante, los "Términos") constituyen un contrato legalmente vinculante celebrado entre cualquier persona que acceda o utilice la plataforma (el "Usuario") y Carlos José Molina Villacorta ("SocialTools", "nosotros" o "la Plataforma").',
          'El acceso a https://www.socialtools.click, la creación de una cuenta mediante Google OAuth, la compra de créditos de video o la contratación de cualquiera de nuestras suscripciones implica la aceptación plena, expresa y sin reservas de la totalidad de estos Términos.',
          'Si no está de acuerdo con alguna de las cláusulas aquí estipuladas, debe abstenerse de utilizar el software.',
        ],
      },
      {
        n: 2,
        title: 'Descripción del Servicio y Arquitectura Técnica',
        paragraphs: [
          'SocialTools proporciona una suite especializada de utilidades de software web diseñada para el análisis forense de video, la purga completa y bitexact de metadatos C2PA, EXIF y XMP, la neutralización de firmas esteganográficas generativas (SynthID) y la modulación multi-variante de clips audiovisuales para creadores de contenido, marcas y agencias de marketing.',
          'La plataforma opera mediante un motor de ejecución en el cliente basado en WebAssembly (@ffmpeg/ffmpeg) y Web Workers. Por consiguiente, el rendimiento y la velocidad de procesamiento dependen estrictamente de las capacidades de hardware (CPU, GPU y memoria RAM) del dispositivo del usuario y de la compatibilidad de su navegador con SharedArrayBuffer.',
          'SocialTools se reserva el derecho de actualizar, optimizar o modificar las funcionalidades técnicas del software en cualquier momento para mantener la compatibilidad con los estándares de la industria.',
        ],
      },
      {
        n: 3,
        title: 'Capacidad Legal y Cuentas de Usuario',
        paragraphs: [
          'El servicio está reservado exclusivamente a personas mayores de 18 años con plena capacidad jurídica para suscribir contratos vinculantes.',
          'El registro y la autenticación se gestionan exclusivamente mediante Google Identity Services (OAuth 2.0). El Usuario garantiza que la cuenta de Google utilizada le pertenece legítimamente y asume la responsabilidad exclusiva por toda la actividad desarrollada bajo su sesión.',
          'Queda prohibido el uso de técnicas de suplantación de identidad o la creación de cuentas automáticas para eludir los límites de uso.',
        ],
      },
      {
        n: 4,
        title: 'Sistema de Créditos, Prueba Gratuita y Precios Vigentes',
        paragraphs: [
          'SocialTools ofrece diferentes modalidades de uso y licenciamiento comercial:',
        ],
        subSections: [
          {
            title: 'a) Crédito Gratuito de Bienvenida (Free Trial)',
            content: [
              'Al registrarse e iniciar sesión por primera vez mediante Google OAuth, todo nuevo usuario recibe automáticamente 1 crédito de video gratuito en su cuenta.',
              'Este crédito tiene como finalidad permitir la prueba exhaustiva y la verificación técnica de los resultados de sanitización forense antes de realizar cualquier desembolso económico.',
            ],
          },
          {
            title: 'b) Modalidad Pago por Uso (Pay-Per-Use Video Credits)',
            content: [
              'Los usuarios pueden adquirir paquetes de créditos de video individuales a razón de $1.00 USD por crédito de video, con una compra mínima obligatoria de 5 créditos ($5.00 USD) hasta un máximo configurable de 1,000 créditos por orden (Paddle Price ID: pri_01m74dmhw68kw11nq225g0rkpr).',
              'Cada crédito de video faculta al usuario para procesar y descargar un video completo con sanitización integral de metadatos.',
              'Los créditos son consumibles y se descuentan unitariamente de su balance tras completar la exportación.',
            ],
          },
          {
            title: 'c) Planes de Suscripción Recurrente',
            content: [
              'Plan Creador Anual: $79.00 USD / año (Paddle Price ID: pri_01m74dfsy5vxssam0b31mypsbt). Proporciona procesamiento sin tope de duración para creadores individuales.',
              'Plan Creador Mensual: $9.99 USD / mes.',
              'Plan Agencia Mensual: $19.99 USD / mes.',
              'Plan Agencia Anual: $99.00 USD / año.',
            ],
          },
          {
            title: 'd) Cuenta de Administración Ilimitada',
            content: [
              'Se reconoce explícitamente que la cuenta negocios.axkarl@gmail.com goza de privilegios ilimitados permanentes sin consumo de créditos ni fecha de expiración.',
            ],
          },
        ],
      },
      {
        n: 5,
        title: 'Paddle como Comerciante Registrado (Merchant of Record)',
        paragraphs: [
          'Todos los pagos, transacciones monetarias y facturación de SocialTools son procesados de forma exclusiva por Paddle (Paddle.com Market Ltd / Paddle Payments Ltd) en calidad de Comerciante Registrado (Merchant of Record - MoR), Seller ID: 471198.',
          'Al efectuar un pago, usted celebra una relación comercial de compraventa directamente con Paddle, quien es legalmente responsable de la recepción de fondos, cálculo y liquidación de impuestos sobre las ventas (IVA, Sales Tax, GST), prevención de fraude y emisión de recibos y facturas fiscales oficiales.',
        ],
      },
      {
        n: 6,
        title: 'Carácter Definitivo de los Pagos y Política de No Reembolso',
        paragraphs: [
          'En atención a la naturaleza digital del software y a la entrega y ejecución inmediata de los créditos de video y membresías, TODOS LOS PAGOS REALIZADOS A TRAVÉS DE PADDLE SON DEFINITIVOS, FIRMES, IRREVOCABLES Y NO REEMBOLSABLES BAJO NINGUNA CIRCUNSTANCIA.',
          'Esta disposición se regula en detalle en la Política Estricta de No Reembolso (/legal/reembolsos), la cual forma parte integrante de estos Términos.',
        ],
      },
      {
        n: 7,
        title: 'Conducta del Usuario y Usos Expresamente Prohibidos',
        paragraphs: [
          'El Usuario se compromete a hacer un uso lícito y ético de la plataforma. Queda terminantemente prohibido:',
        ],
        list: [
          'Manipular, interceptar o falsear las peticiones a la API para evadir el cómputo y descuento de créditos de video.',
          'Descompilar, desensamblar, desofuscar o realizar ingeniería inversa sobre el motor WebAssembly de la plataforma.',
          'Procesar archivos que contengan material de abuso sexual infantil (CSAM), apología del terrorismo, amenazas, ciberacoso o material que infrinja leyes penales de cualquier jurisdicción.',
          'Procesar videos sobre los cuales el usuario no ostente la legítima titularidad de los derechos de propiedad intelectual o la correspondiente autorización de sus titulares.',
          'Llevar a cabo ataques de denegación de servicio (DoS/DDoS) o intentar vulnerar la seguridad de la infraestructura.',
        ],
        footnote:
          'La vulneración de estas prohibiciones motivará la rescisión inmediata de la cuenta del usuario, la revocación de créditos remanentes sin compensación y el ejercicio de las acciones penales o civiles oportunas.',
      },
      {
        n: 8,
        title: 'Propiedad Intelectual sobre la Plataforma',
        paragraphs: [
          'Todo el código fuente, binarios de WebAssembly, scripts, interfaces de usuario, diseños visuales, marcas, nombres comerciales y logotipos relativos a SocialTools son propiedad exclusiva de Carlos José Molina Villacorta o de sus licenciantes.',
          'Se concede al usuario una licencia de uso limitada, no exclusiva, intransferible y revocable para utilizar el software de conformidad con el saldo de créditos o plan activo adquirido.',
        ],
      },
      {
        n: 9,
        title: 'Titularidad del Usuario sobre sus Archivos Multimedia',
        paragraphs: [
          'El Usuario conserva el 100% de la propiedad intelectual, derechos de autor y derechos morales y patrimoniales sobre los archivos de video originales que procese y sobre los videos exportados generados mediante la plataforma.',
          'SocialTools no reivindica ningún derecho sobre sus creaciones, no almacena copias de sus contenidos y no utiliza sus videos para entrenar modelos de inteligencia artificial ni para ningún otro fin.',
        ],
      },
      {
        n: 10,
        title: 'Exoneración de Responsabilidad Técnica y Algorítmica',
        paragraphs: [
          'SocialTools ejecuta la purga rigurosa de metadatos C2PA, EXIF y XMP conforme a los estándares técnicos vigentes.',
          'No obstante, SocialTools no garantiza ni puede garantizar que plataformas externas de redes sociales (tales como TikTok, Meta/Instagram, YouTube, X u otras) no modifiquen de manera arbitraria o sobrevenida sus algoritmos de detección, políticas internas de moderación de contenido o directrices de distribución.',
          'La decisión final de publicar, difundir o monetizar los videos procesados en dichas redes sociales es de la exclusiva e indelegable incumbencia del usuario. SocialTools queda eximido de cualquier responsabilidad por penalizaciones, pérdida de visibilidad (shadowban) o suspensión de cuentas en plataformas de terceros.',
        ],
      },
      {
        n: 11,
        title: 'Limitación de Responsabilidad Económica',
        paragraphs: [
          'En la máxima medida autorizada por la normativa aplicable, SocialTools y su operador no serán en ningún caso responsables por daños indirectos, punitivos, incidentales, lucro cesante o pérdidas de ingresos derivados del uso o la imposibilidad de uso del software.',
          'La responsabilidad económica máxima acumulada de SocialTools frente al usuario por cualquier reclamación contractual o extracontractual quedará estrictamente limitada al importe total neto efectivamente abonado por dicho usuario durante los tres (3) meses inmediatamente anteriores al hecho causante.',
        ],
      },
      {
        n: 12,
        title: 'Disponibilidad del Servicio y Mantenimiento',
        paragraphs: [
          'Procuramos asegurar una disponibilidad continua del servicio. Sin embargo, el acceso puede suspenderse temporalmente por razones de mantenimiento técnico, actualizaciones o fallos imputables a proveedores de red o infraestructura en la nube.',
          'SocialTools no asume responsabilidad alguna por demoras o interrupciones imprevistas ajenas a su control directo.',
        ],
      },
      {
        n: 13,
        title: 'Cancelación de Suscripciones y Cierre de Cuenta',
        paragraphs: [
          'El usuario puede cancelar la renovación automática de su suscripción en cualquier momento a través del enlace facilitado en los recibos emitidos por Paddle.com.',
          'La cancelación evitará el cobro de la siguiente anualidad o mensualidad, manteniendo el acceso operativo hasta la fecha límite del periodo previamente abonado.',
        ],
      },
      {
        n: 14,
        title: 'Modificaciones a las Condiciones',
        paragraphs: [
          'SocialTools se reserva el derecho de modificar o actualizar estos Términos para reflejar variaciones operativas, comerciales o jurídicas.',
          'Las modificaciones cobrarán vigencia desde el momento de su publicación en el sitio web oficial. La utilización continuada del servicio tras la publicación de los Términos modificados constituirá la aceptación íntegra de los mismos.',
        ],
      },
      {
        n: 15,
        title: 'Legislación Aplicable y Resolución de Controversias',
        paragraphs: [
          'Estos Términos se rigen e interpretan de conformidad con la legislación civil y mercantil aplicable a los contratos electrónicos y servicios de software.',
          'Para la solución de cualquier controversia o divergencia que surja en relación con este contrato, las partes se comprometen a intentar una solución negociada y amistosa en primera instancia, remitiendo su reclamación motivada a negocios.axkarl@gmail.com.',
        ],
        footnote:
          'Términos y Condiciones actualizados al 11 de noviembre de 2026. SocialTools · https://www.socialtools.click.',
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 3. POLÍTICA ESTRICTA DE NO REEMBOLSO Y DEVOLUCIONES
  // ───────────────────────────────────────────────────────────────────────────
  reembolsos: {
    slug: 'reembolsos',
    title: 'Política Estricta de No Reembolso y Devoluciones',
    metaTitle: 'Política Estricta de No Reembolso | SocialTools',
    metaDescription:
      'Política oficial de SocialTools sobre compras de créditos y suscripciones: pagos firmes, definitivos e irrevocablemente NO reembolsables conforme a directivas digitales.',
    keywords: [
      'política de no reembolso',
      'sin reembolso',
      'créditos de video no reembolsables',
      'desistimiento digital',
      'paddle reembolsos',
      'socialtools reembolsos',
    ],
    category: 'DOCUMENTOS LEGALES',
    tagline: 'Regulación vinculante sobre compras de créditos de video, suscripciones y renuncia irrevocable al reembolso.',
    icon: 'rotate-ccw',
    date: '11 Nov, 2026',
    lastUpdated: '11 de noviembre de 2026',
    readingTime: 12,
    available: true,
    sections: [
      {
        n: 1,
        title: 'Naturaleza Digital del Software y Servicios de Ejecución Inmediata',
        paragraphs: [
          'SocialTools suministra software de procesamiento y sanitización multimedia que se ejecuta localmente en su navegador, paquetes de créditos consumibles de video y planes de suscripción de acceso inmediato.',
          'La entrega del producto o servicio se produce y perfecciona de manera instantánea en el momento exacto en que la pasarela de pagos de Paddle.com confirma la transacción:',
        ],
        list: [
          'En la modalidad de pago por uso: Los créditos de video adquiridos (a razón de $1.00 USD por video, paquete mínimo de 5 créditos por $5.00 USD) se incorporan de manera inmediata y automatizada al balance de la cuenta del usuario en nuestra base de datos.',
          'En las suscripciones periódicas: Las prestaciones del Plan Creador Anual ($79.00 USD/año) o de los planes de Agencia quedan activadas y disponibles de inmediato para su disfrute ilimitado.',
        ],
      },
      {
        n: 2,
        title: 'POLÍTICA ESTRICTA DE NO REEMBOLSO (DEFINITIVA E IRREVOCABLE)',
        paragraphs: [
          'TODO PAGO REALIZADO A SOCIALTOOLS A TRAVÉS DE PADDLE.COM POR CONCEPTO DE PAQUETES DE CRÉDITOS DE VIDEO O SUSCRIPCIONES PERIÓDICAS ES DEFINITIVO, FIRME, IRREVOCABLE Y NO REEMBOLSABLE BAJO NINGUNA CIRCUNSTANCIA.',
          'Una vez que los créditos son depositados en la cuenta del usuario o que el periodo de suscripción ha comenzado, NO se admitirán devoluciones, reembolsos totales, reembolsos parciales ni reembolsos prorrateados.',
          'El servicio se considera total y debidamente suministrado desde el instante en que el usuario tiene la potestad técnica de consumir sus créditos o utilizar las herramientas prémium.',
        ],
        infoBox: {
          type: 'alert',
          title: 'Aviso Vinculante de Pago Definitivo',
          text: 'Todas las compras en SocialTools son definitivas. No se realizan devoluciones ni reembolsos de dinero bajo ningún concepto una vez procesado el pago.',
        },
      },
      {
        n: 3,
        title: 'Garantía Técnica Previa Mediante Crédito Gratuito (Free Trial)',
        paragraphs: [
          'Para eliminar cualquier asimetría o duda sobre el funcionamiento del software, SocialTools otorga automáticamente 1 crédito de video gratuito de bienvenida a toda nueva cuenta creada con Google.',
          'Esta prueba gratuita faculta al usuario para someter a prueba el motor de sanitización WebAssembly con un video real de su propiedad, comprobar la velocidad de procesamiento de su equipo y certificar la eliminación completa de los bloques C2PA, EXIF y XMP ANTES de tomar cualquier decisión de compra.',
          'Por consiguiente, cuando el usuario decide voluntariamente adquirir créditos de pago por uso o una suscripción, lo hace con pleno conocimiento de causa y tras haber verificado la idoneidad del servicio mediante su crédito de cortesía.',
        ],
        infoBox: {
          type: 'green',
          title: 'Prueba Antes de Pagar',
          text: 'Dispones de 1 crédito 100% gratuito al iniciar sesión para verificar la calidad del software antes de comprar cualquier paquete de créditos.',
        },
      },
      {
        n: 4,
        title: 'Renuncia Expresa al Derecho Legal de Desistimiento (14 Días)',
        paragraphs: [
          'De conformidad con el artículo 16, letra m) de la Directiva 2011/83/UE sobre los derechos de los consumidores, el artículo 103, letra m) del Real Decreto Legislativo 1/2007 de España y normativas análogas de comercio digital a nivel internacional:',
          'El derecho de desistimiento o periodo de reflexión de 14 días NO ES APLICABLE al suministro de contenido digital que no se preste en soporte material cuando la ejecución ha comenzado con el previo consentimiento expreso del consumidor.',
          'Al completar su compra en el checkout de Paddle, el usuario otorga formalmente su consentimiento previo y expreso para la ejecución inmediata del servicio y RECONOCE EXPRESAMENTE QUE PIERDE SU DERECHO DE DESISTIMIENTO desde el momento en que se acreditan los créditos o se habilita el acceso a la plataforma.',
        ],
      },
      {
        n: 5,
        title: 'Cancelación de Suscripciones y Renovaciones Futuras',
        paragraphs: [
          'Los usuarios con planes de suscripción recurrente (mensual o anual) pueden cancelar la renovación automática en cualquier momento antes de que se liquide el siguiente ciclo de facturación.',
          'La cancelación de la suscripción se realiza de forma directa y autónoma desde el enlace de gestión incluido en todos los recibos y correos de confirmación remitidos por Paddle.com, o bien solicitándolo por correo a negocios.axkarl@gmail.com.',
          'Efectos de la cancelación: La cancelación detiene de forma definitiva todos los cobros futuros, pero no da derecho al reembolso retrospectivo de cuotas ya pagadas ni a la devolución prorrateada de los días restantes del ciclo en curso. El usuario conservará acceso completo a las funciones contratadas hasta la finalización del periodo pagado.',
        ],
      },
      {
        n: 6,
        title: 'Naturaleza Consumible de los Créditos de Video',
        paragraphs: [
          'Los créditos adquiridos en la modalidad de pago por uso:',
          '1. Son consumibles de forma unitaria al procesar y exportar con éxito cada archivo de video.',
          '2. No son canjeables en ningún caso por dinero en efectivo, transferencias bancarias ni medios de pago equivalentes.',
          '3. Son intransferibles entre distintas cuentas de usuario.',
          '4. Permanecen disponibles en la cuenta del usuario para su consumo mientras la cuenta se mantenga en estado activo.',
        ],
      },
      {
        n: 7,
        title: 'Prohibición de Contracargos y Disputas Bancarias Fraudulentas',
        paragraphs: [
          'El Usuario se compromete de forma expresa a no formular reclamaciones de contracargo (chargebacks), reversiones de tarjeta o disputas injustificadas ante su entidad bancaria o proveedora de tarjeta de crédito fundadas en motivos de arrepentimiento de compra o inconformidad subjetiva con el software.',
          'En el supuesto de que un usuario promueva una disputa o contracargo infundado:',
        ],
        list: [
          'SocialTools y Paddle remitirán al banco emisor la prueba fehaciente de la entrega del servicio digital (marcas de tiempo de login con Google OAuth, dirección IP, registro de consumo del crédito gratuito y acreditación de los créditos adquiridos).',
          'La cuenta del usuario será suspendida y dada de baja de forma inmediata e irrevocable, perdiendo todo el saldo remanente acumulado.',
          'Nos reservamos el derecho de reclamar los costes administrativos, tasas por disputa y daños ocasionados.',
        ],
      },
      {
        n: 8,
        title: 'Canal Oficial de Asistencia y Soporte Técnico',
        paragraphs: [
          'Si usted experimenta algún inconveniente técnico durante el uso de sus créditos o tiene dudas sobre el funcionamiento de la plataforma, nuestro equipo técnico está a su entera disposición para resolver cualquier anomalía.',
          'Contáctenos directamente a través de nuestro correo oficial de soporte: negocios.axkarl@gmail.com, detallando su dirección de correo de usuario y el identificador de la transacción.',
        ],
        footnote:
          'Política Estricta de No Reembolso en vigor desde el 11 de noviembre de 2026. Aplicable a todas las transacciones procesadas mediante Paddle.com para SocialTools.',
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 4. AVISO LEGAL E INFORMACIÓN CORPORATIVA
  // ───────────────────────────────────────────────────────────────────────────
  'aviso-legal': {
    slug: 'aviso-legal',
    title: 'Aviso Legal e Información Corporativa',
    metaTitle: 'Aviso Legal e Información Corporativa | SocialTools',
    metaDescription:
      'Aviso legal y datos identificativos de SocialTools: operador de la plataforma Carlos José Molina Villacorta, marco LSSI-CE y pasarela Merchant of Record Paddle.',
    keywords: [
      'aviso legal',
      'información corporativa',
      'carlos josé molina villacorta',
      'carlosm-lab',
      'paddle merchant of record',
      'socialtools click',
    ],
    category: 'DOCUMENTOS LEGALES',
    tagline: 'Información identificativa del operador de la plataforma, marco de comercio electrónico y pasarela Merchant of Record.',
    icon: 'scale',
    date: '11 Nov, 2026',
    lastUpdated: '11 de noviembre de 2026',
    readingTime: 10,
    available: true,
    sections: [
      {
        n: 1,
        title: 'Datos Identificativos del Prestador de Servicios',
        paragraphs: [
          'En cumplimiento del principio de transparencia y la normativa sobre servicios de la sociedad de la información y comercio electrónico (LSSI-CE), se pone en conocimiento de los usuarios los datos identificativos del titular de la plataforma:',
        ],
        list: [
          'Titular / Operador Responsable: Carlos José Molina Villacorta.',
          'Identificador de Desarrollo y Repositorio: carlosm-lab (GitHub).',
          'Nombre Comercial: SocialTools Studio (SocialTools).',
          'Dominio Web Oficial: https://www.socialtools.click.',
          'Correo Electrónico de Contacto Institucional: negocios.axkarl@gmail.com.',
        ],
      },
      {
        n: 2,
        title: 'Comerciante Registrado (Merchant of Record - Paddle)',
        paragraphs: [
          'Se informa a todos los usuarios y compradores que la comercialización internacional de licencias de software, el cobro de paquetes de créditos de video y las suscripciones periódicas se canalizan a través de Paddle como Comerciante Registrado (Merchant of Record - MoR):',
        ],
        list: [
          'Entidades Operadoras de Paddle: Paddle.com Market Ltd (domiciliada en Judd House, 18-29 Mora Street, London, EC1V 8BT, Reino Unido) y Paddle Payments Ltd (domiciliada en Core 1, Number 1, Sandyford Road, Sandyford Business Park, Dublín 18, Irlanda).',
          'Identificador Oficial de Vendedor (Seller ID): 471198.',
          'Alcance de Paddle: Paddle es el comerciante legal que procesa el cobro, asume el cumplimiento tributario global (cálculo y remisión de IVA / Sales Tax), gestiona la prevención de fraude y emite las facturas oficiales al consumidor.',
        ],
        infoBox: {
          type: 'blue',
          title: 'Facturación Transparente con Paddle',
          text: 'Sus transacciones son procesadas de manera segura bajo el estándar bancario PCI-DSS Nivel 1 por Paddle como Merchant of Record oficial.',
        },
      },
      {
        n: 3,
        title: 'Objeto de la Plataforma y Actividad Tecnológica',
        paragraphs: [
          'SocialTools proporciona una plataforma web que integra herramientas forenses para el análisis de metadatos multimedia y la eliminación sistemática de bloques C2PA, EXIF, y XMP en clips de video.',
          'Todo el procesamiento se desarrolla en el entorno local del navegador del cliente mediante la tecnología WebAssembly, sin almacenamiento de los videos del usuario en servidores centrales.',
        ],
      },
      {
        n: 4,
        title: 'Condiciones Generales de Uso del Portal',
        paragraphs: [
          'El acceso general a la información pública del sitio web https://www.socialtools.click es gratuito.',
          'El uso del motor de sanitización de video requiere el inicio de sesión a través de Google Identity y la disponibilidad de créditos válidos o suscripción activa (contando todo nuevo usuario con 1 crédito gratuito de bienvenida).',
          'El usuario se compromete a no utilizar el portal con fines ilícitos, lesivos de los derechos e intereses de terceros, o que de cualquier forma puedan sobrecargar, inutilizar o deteriorar la infraestructura de telecomunicaciones de la plataforma.',
        ],
      },
      {
        n: 5,
        title: 'Propiedad Intelectual e Industrial',
        paragraphs: [
          'La estructura del sitio web, código fuente, compilaciones WebAssembly, diseño gráfico, logotipos, textos y documentación técnica son propiedad exclusiva de Carlos José Molina Villacorta o se encuentran bajo licencias de código abierto compatibles.',
          'Queda expresamente prohibida la copia, reproducción, ingeniería inversa, distribución pública o transformación de cualquier contenido o binario de la plataforma sin autorización expresa y previa por escrito del titular.',
        ],
      },
      {
        n: 6,
        title: 'Exclusión de Garantías y Responsabilidad',
        paragraphs: [
          'SocialTools no otorga ninguna garantía ni se hace responsable, en ningún caso, de los daños y perjuicios de cualquier naturaleza que pudieran traer causa de:',
          '1. La falta de disponibilidad, continuidad o correcto funcionamiento del sitio web por causas de fuerza mayor o mantenimiento no programado.',
          '2. La incompatibilidad del navegador o del hardware del usuario con los requisitos técnicos de WebAssembly y SharedArrayBuffer.',
          '3. Modificaciones sobrevenidas en las políticas de detección y moderación algorítmica de redes sociales externas (TikTok, Instagram, YouTube, etc.).',
        ],
      },
      {
        n: 7,
        title: 'Enlaces de Terceros (Hipervínculos)',
        paragraphs: [
          'La plataforma puede contener enlaces hacia sitios web de terceros (como Google Cloud, Paddle o GitHub). Dichos enlaces se facilitan únicamente para conveniencia del usuario.',
          'SocialTools no ejerce control sobre el contenido de dichos sitios ni asume responsabilidad alguna por las políticas de privacidad o condiciones de uso de terceros.',
        ],
      },
      {
        n: 8,
        title: 'Legislación y Fuero Jurisdiccional',
        paragraphs: [
          'Las relaciones entre SocialTools y los usuarios se regirán por las leyes aplicables al comercio electrónico y los contratos de software.',
          'Las partes acuerdan someter cualquier disputa o controversia en primer lugar a un procedimiento de mediación amistosa a través de negocios.axkarl@gmail.com.',
        ],
        footnote:
          'Aviso Legal e Información Corporativa vigente desde el 11 de noviembre de 2026. SocialTools.',
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 5. POLÍTICA DE COOKIES Y TECNOLOGÍAS DE NAVEGADOR
  // ───────────────────────────────────────────────────────────────────────────
  cookies: {
    slug: 'cookies',
    title: 'Política de Cookies y Tecnologías de Navegador',
    metaTitle: 'Política de Cookies y Tecnologías de Navegador | SocialTools',
    metaDescription:
      'Política de cookies de SocialTools: uso exclusivo de cookies técnicas de sesión, almacenamiento local no invasivo y cero cookies publicitarias.',
    keywords: [
      'política de cookies',
      'cookies técnicas',
      'cookies de sesión',
      'cero rastreo publicitario',
      'localstorage',
      'socialtools cookies',
    ],
    category: 'DOCUMENTOS LEGALES',
    tagline: 'Información sobre el uso exclusivo de cookies técnicas esenciales y almacenamiento local en SocialTools.',
    icon: 'cookie',
    date: '11 Nov, 2026',
    lastUpdated: '11 de noviembre de 2026',
    readingTime: 10,
    available: true,
    sections: [
      {
        n: 1,
        title: '¿Qué son las Cookies y Tecnologías Similares?',
        paragraphs: [
          'Una cookie es un fichero de texto de reducido tamaño que un servidor web descarga y almacena en el navegador de su dispositivo cuando usted visita determinadas páginas web.',
          'El almacenamiento local (localStorage y sessionStorage) es una tecnología moderna de los navegadores que permite conservar pares clave-valor de manera segura y privada en su dispositivo sin transmitirlos automáticamente en cada solicitud HTTP hacia los servidores.',
        ],
      },
      {
        n: 2,
        title: 'Cookies Técnicas Estrictamente Necesarias que Utilizamos',
        paragraphs: [
          'SocialTools aplica un principio estricto de minimización tecnológica. ÚNICAMENTE utilizamos cookies técnicas imprescindibles para la operatividad y la seguridad de la plataforma:',
        ],
        list: [
          'st_session / __Secure-next-auth.session-token: Cookie técnica cifrada emitida tras autenticarse con Google OAuth. Almacena de forma segura su identificador de sesión. Configurada con atributos HttpOnly, Secure y SameSite=Lax para máxima protección contra interceptación o ataques CSRF.',
          'paddlejs-session / cookies de checkout de Paddle: Cookies técnicas generadas temporalmente por el script oficial de Paddle.com al abrir el flujo de checkout, indispensables para procesar de forma segura la compra y prevenir fraudes con tarjetas de crédito.',
        ],
        infoBox: {
          type: 'green',
          title: 'Cookies Esenciales Únicamente',
          text: 'No requerimos banner de consentimiento invasivo porque nuestras cookies son 100% técnicas y funcionales, exentas conforme al art. 22.2 de la LSSI y directrices del Comité Europeo de Protección de Datos (EDPB).',
        },
      },
      {
        n: 3,
        title: 'Uso de Almacenamiento Local (localStorage y sessionStorage)',
        paragraphs: [
          'Hacemos un uso transparente y restringido del almacenamiento local del navegador para mejorar la experiencia de usuario:',
        ],
        subSections: [
          {
            title: 'a) sessionStorage (socialtools_legal_return)',
            content: [
              'Se almacena un valor booleano temporal cuando el usuario pulsa el botón de cerrar en el lector de artículos legales.',
              'Finalidad: Permitir que LegalHubClient detecte que el usuario regresa intencionalmente desde un documento y omita las animaciones de entrada en /legal, evitando la molesta sensación de recarga de página.',
              'Persistencia: Se destruye automáticamente al cerrar la pestaña o tras la primera lectura.',
            ],
          },
          {
            title: 'b) localStorage (st_credits_cache y preferencias)',
            content: [
              'Almacena una copia de caché del balance de créditos del usuario para evitar llamadas redundantes a la API en cada renderizado de la interfaz, así como las preferencias de modo visual.',
              'No contiene información bancaria ni datos sensibles de rastreo.',
            ],
          },
        ],
      },
      {
        n: 4,
        title: 'DECLARACIÓN FORMAL: CERO RASTREO Y CERO PUBLICIDAD',
        paragraphs: [
          'SocialTools mantiene una política rigurosa de respeto a la privacidad del usuario:',
          '1. CERO cookies de publicidad comportamental: No mostramos anuncios ni monetizamos datos de tráfico.',
          '2. CERO píxeles de remarketing: No instalamos Meta Pixel (Facebook Pixel), TikTok Pixel ni etiquetas de retargeting publicitario.',
          '3. CERO trackers de terceros: No vendemos ni compartimos sus huellas de navegación con intermediarios publicitarios ni redes de analítica de terceros.',
        ],
      },
      {
        n: 5,
        title: 'Cómo Gestionar y Desactivar Cookies en su Navegador',
        paragraphs: [
          'Usted puede en cualquier momento restringir, bloquear o borrar las cookies de SocialTools configurando las opciones de su navegador web:',
        ],
        list: [
          'Google Chrome: Configuración > Privacidad y seguridad > Cookies y otros datos de sitios web.',
          'Mozilla Firefox: Ajustes > Privacidad y Seguridad > Cookies y datos del sitio.',
          'Apple Safari: Preferencias > Privacidad > Gestionar datos del sitio web.',
          'Microsoft Edge: Configuración > Cookies y permisos del sitio > Cookies y datos almacenados.',
        ],
        footnote:
          'Nota: Si bloquea totalmente las cookies técnicas en su navegador, no podrá iniciar sesión con su cuenta de Google ni completar compras a través de Paddle.',
      },
      {
        n: 6,
        title: 'Actualizaciones de la Política de Cookies',
        paragraphs: [
          'Esta política puede actualizarse para reflejar cambios técnicos en los componentes del software o normativas de telecomunicaciones. Le invitamos a revisarla periódicamente.',
        ],
        footnote:
          'Política de Cookies en vigor desde el 11 de noviembre de 2026. SocialTools · https://www.socialtools.click.',
      },
    ],
  },
};
