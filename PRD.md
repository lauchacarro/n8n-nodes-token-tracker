# PRD - AI Token Tracking Node para N8N

## 🎯 Product Vision
Crear un nodo personalizado de N8N que funcione como middleware de tracking para tokens de AI, proporcionando monitoreo detallado del consumo de tokens y capacidad de ejecutar workflows secundarios con la información recopilada.

## 🔍 Problem Statement
Actualmente no existe una forma centralizada de trackear el consumo de tokens de diferentes modelos de AI en N8N. Los usuarios necesitan:
- Monitorear el consumo de tokens en tiempo real
- Registrar estadísticas de uso por workflow/nodo
- Ejecutar workflows secundarios basados en el consumo
- Tener visibilidad de costos y métricas de AI

## 🎯 Target Users
- Desarrolladores que utilizan múltiples modelos de AI en N8N
- Equipos que necesitan monitorear costos de AI
- Administradores de sistemas que requieren auditoría de uso
- Empresas que necesitan reportes de consumo de tokens

## 🚀 Core Features

### 1. Token Tracking Middleware
- **Intercepta** todas las llamadas a modelos de AI conectados
- **Registra** tokens de entrada (input) y salida (output)
- **Calcula** costos basados en precios configurables por modelo
- **Almacena** métricas temporalmente para procesamiento

### 2. Sub-workflow Execution
- **Ejecuta** workflows secundarios pasando datos de tracking
- **Configurable** para ejecutar en diferentes momentos:
  - Después de cada llamada
  - Al alcanzar umbrales de tokens
  - En intervalos de tiempo
  - Al completar el workflow principal

### 3. Configuración Flexible
- **Selección** de modelo de AI a interceptar
- **Configuración** de precios por token por modelo
- **Definición** de umbrales y alertas
- **Mapeo** de datos para sub-workflows

### 4. Output de Datos
- **Pasa** la respuesta original del modelo sin modificar
- **Añade** metadata de tracking
- **Proporciona** métricas acumuladas
- **Mantiene** compatibilidad total con workflows existentes

## 📋 Technical Requirements

### Input Connections
- 1 conexión principal de datos (NodeConnectionTypes.Main)
- 1 conexión de modelo AI (NodeConnectionTypes.AiLanguageModel)

### Output Connections
- 1 salida principal con respuesta del modelo + metadata
- 1 salida de modelo AI (passthrough)

### Configuration Parameters
```typescript
interface TokenTrackingConfig {
  model: {
    source: 'connected'; // Solo modelo conectado por ahora
  };
  tracking: {
    enableInputTokens: boolean;
    enableOutputTokens: boolean;
  };
  subWorkflow: {
    enabled: boolean;
    trigger: 'always' | 'threshold' | 'interval';
    workflowId: string;
    thresholdTokens?: number;
    intervalMinutes?: number;
  };
  storage: {
    storageMode: 'memory' | 'workflow-data';
    maxHistoryItems: number;
  };
}
```

### Data Flow
1. **Input**: Recibe datos del workflow principal
2. **Intercept**: Intercepta llamada al modelo AI
3. **Track**: Registra tokens antes y después
4. **Execute**: Ejecuta sub-workflow si está configurado
5. **Output**: Retorna respuesta original + metadata de tracking

## 🔧 Implementation Details

### Node Structure
```
AITokenTracking/
├── AITokenTracking.node.ts          # Nodo principal
├── GenericFunctions.ts               # Funciones auxiliares
├── TokenTracker.ts                   # Lógica de tracking
├── helpers/
│   ├── ModelInterceptor.ts          # Interceptor de modelos AI
│   ├── CostCalculator.ts            # Calculadora de costos
│   └── SubWorkflowExecutor.ts       # Ejecutor de sub-workflows
└── types/
    └── index.ts                     # Definiciones de tipos
```

### Key Classes
- **AITokenTracking**: Nodo principal que implementa INodeType
- **TokenTracker**: Maneja la lógica de conteo y almacenamiento
- **ModelInterceptor**: Wrapper para modelos AI que cuenta tokens
- **SubWorkflowExecutor**: Ejecuta workflows secundarios con datos de tracking

## 🧪 Testing Strategy
- **Unit Tests**: Para cada función de tracking y cálculo
- **Integration Tests**: Para intercepción de modelos reales
- **Sub-workflow Tests**: Validar ejecución correcta de workflows secundarios
- **Performance Tests**: Medir overhead del tracking

## 📦 Packaging & Distribution
- **NPM Package**: `@custom/n8n-nodes-ai-token-tracking`
- **Versioning**: Semantic versioning (1.0.0)
- **Dependencies**: Minimizar dependencias externas
- **Compatibility**: N8N v1.0+

## 🔮 Future Enhancements
- Integración con bases de datos externas
- Dashboard web para visualizar métricas
- Alertas por email/webhook
- Soporte para múltiples modelos simultáneos
- Exportación de reportes
- Configuración de límites por usuario/proyecto

## 📊 Success Metrics
- **Funcional**: Tracking preciso de tokens (>99% accuracy)
- **Performance**: Overhead < 50ms por llamada
- **Reliability**: Sub-workflows ejecutados correctamente (>99% success rate)
- **Usability**: Configuración completada en < 5 minutos
