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
