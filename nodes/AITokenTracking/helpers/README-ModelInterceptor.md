# ModelInterceptor Usage Guide

El `ModelInterceptor` ahora soporta tanto el tracking de tokens como el logging de N8N de manera escalable y mantenible.

## Funcionalidades Disponibles

### 1. TokenTrackingCallback
- Rastrea el uso de tokens (input, output, total)
- Estima tokens de entrada desde prompts
- Extrae información real de tokens desde las respuestas del modelo

### 2. N8nLoggingCallback  
- Replica la funcionalidad de `N8nNonEstimatingTracing`
- Registra logs de input y output en N8N
- Muestra datos en la UI de N8N usando `addInputData` y `addOutputData`
- Registra eventos AI usando `logAiEvent`
- Maneja errores específicos para N8N

### 3. CombinedTrackingCallback
- Combina ambas funcionalidades de manera eficiente
- Ejecuta ambos callbacks en paralelo
- Proporciona acceso a callbacks individuales

## Uso Básico (Solo Token Tracking)

```typescript
import { ModelInterceptor } from './ModelInterceptor';

const interceptor = new ModelInterceptor(
    chatModel,
    (tokenUsage) => {
        console.log('Token usage:', tokenUsage);
    }
);

const wrappedModel = interceptor.getWrappedModel();
```

## Uso Avanzado (Token Tracking + N8N Logging)

```typescript
import { ModelInterceptor } from './ModelInterceptor';

const interceptor = new ModelInterceptor(
    chatModel,
    (tokenUsage) => {
    },
    executionFunctions, // ISupplyDataFunctions from N8N
    {
        enableN8nLogging: true,
        errorDescriptionMapper: (error) => `Custom error: ${error.message}`
    }
);

const wrappedModel = interceptor.getWrappedModel();

// Verificar si N8N logging está habilitado
if (interceptor.isN8nLoggingEnabled()) {
    console.log('N8N logging is active');
}
```

## Acceso a Callbacks Específicos

```typescript
// Acceder al callback de tokens
const tokenCallback = interceptor.getTokenCallback();

// Acceder al callback de N8N (solo si está habilitado)
const n8nCallback = interceptor.getN8nCallback();

if (n8nCallback) {
    console.log('N8N logging callback available');
}
```

## Arquitectura Escalable

El diseño permite:

1. **Coexistencia**: Ambas lógicas pueden trabajar juntas sin conflictos
2. **Mantenibilidad**: Cada callback maneja su responsabilidad específica
3. **Escalabilidad**: Fácil agregar nuevos tipos de tracking en el futuro
4. **Flexibilidad**: Usar solo el tracking necesario según el contexto

## Parámetros de Configuración

### ModelInterceptor Constructor

- `model`: BaseChatModel - El modelo de IA a interceptar
- `onTokensTracked`: función callback para recibir datos de tokens
- `executionFunctions?`: ISupplyDataFunctions - Funciones de ejecución de N8N (opcional)
- `options?`: Opciones de configuración
  - `enableN8nLogging?`: boolean - Habilitar logging de N8N
  - `errorDescriptionMapper?`: función para mapear descripciones de error

## Información del Modelo Extraída

El interceptor automáticamente extrae:
- `provider`: openai, anthropic, azure_openai, cohere, etc.
- `modelName`: Nombre específico del modelo
- `modelVersion`: Versión del modelo (si está disponible)
- `modelId`: ID combinado modelo-versión

Esta información se incluye en todos los tracking de tokens y logs de N8N.
