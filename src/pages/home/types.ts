export type Appointment = {
  ID: string;
  "Дата и время": string;
  "Дата n8n": string;
  "Доктор ФИО": string;
  "Пациент ФИО": string;
  Статус: "Оплачено" | "Ожидаем" | "Со скидкой" | string;
  Ночь: boolean | string;
  Стоимость: number;
  "Итого, сом"?: number;
  "Наличные"?: number;
  "Безналичные"?: number;
  "Долг"?: number;
};

export type RuAppointmentRow = {
  "ID": string | number;
  "Дата и время": string | null;
  "Дата n8n": string | null;
  "Доктор ФИО": string | null;
  "Пациент ФИО": string | null;
  // возможные альтернативные поля в представлении/запросе
  "Доктор": string | null;
  "Доктор Имя": string | null;
  "Доктор Фамилия": string | null;
  "Пациент": string | null;
  "Пациент Имя": string | null;
  "Пациент Фамилия": string | null;

  "Прием ID"?: string | number | null;
  "Appointment ID"?: string | number | null;
  "Appointment_Id"?: string | number | null;
  "Запись ID"?: string | number | null;
  "Запись"?: string | number | null;
  "id"?: string | number | null;

  "Статус": string | null;
  "Ночь": boolean | string | null;
  "Стоимость": number | string | null;
  "Итого, сом": number | string | null;
  "Скидка": number | string | null;
  "Наличные": number | string | null;
  "Безналичные": number | string | null;
  "Долг": number | string | null;
};
