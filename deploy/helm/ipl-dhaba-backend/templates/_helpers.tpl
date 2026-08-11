{{/*
Expand the name of the chart.
*/}}
{{- define "ipl-dhaba-backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Name of the Secret the pods read their credentials from.

Three ways to supply it, one name to consume: an ExternalSecret rendered by this
chart, a Secret an operator created out of band, or one created imperatively and
named in `secrets.existingSecret`. The chart itself never carries the values.
*/}}
{{- define "ipl-dhaba-backend.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- printf "%s-secret" (include "ipl-dhaba-backend.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "ipl-dhaba-backend.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
